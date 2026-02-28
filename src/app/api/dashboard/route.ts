import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startOfWeek, endOfWeek } from "date-fns";
import { groupPunchesByDay, pairPunchesForDay } from "@/lib/punchPairing";
import { requireAuth } from "@/lib/authHelpers";
import { getEffectivePayRates } from "@/lib/payRateHistory";

export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let rangeStart: Date;
    let rangeEnd: Date;

    if (startDateParam && endDateParam) {
      rangeStart = new Date(startDateParam + "T00:00:00");
      rangeEnd = new Date(endDateParam + "T23:59:59.999");
    } else {
      const now = new Date();
      rangeStart = startOfWeek(now, { weekStartsOn: 1 });
      rangeEnd = endOfWeek(now, { weekStartsOn: 1 });
    }

    const activeEmployees = await prisma.employee.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        code: true,
        payRate: true,
        overtimeEnabled: true,
        overtimeThreshold: true,
        overtimeMultiplier: true,
      },
    });

    const punches = await prisma.punch.findMany({
      where: {
        timestamp: { gte: rangeStart, lte: rangeEnd },
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            payRate: true,
            overtimeEnabled: true,
            overtimeThreshold: true,
            overtimeMultiplier: true,
          },
        },
      },
      orderBy: { timestamp: "asc" },
    });

    // Get payouts in date range
    const payouts = await prisma.payout.findMany({
      where: {
        date: { gte: rangeStart, lte: rangeEnd },
      },
    });

    const punchesByEmployee = new Map<string, typeof punches>();
    for (const punch of punches) {
      const empId = punch.employeeId;
      if (!punchesByEmployee.has(empId)) {
        punchesByEmployee.set(empId, []);
      }
      punchesByEmployee.get(empId)!.push(punch);
    }

    // Batch fetch effective pay rates for all active employees
    const effectiveRates = await getEffectivePayRates(
      activeEmployees.map((e) => e.id),
      rangeStart
    );

    let totalHours = 0;
    let totalCost = 0;
    let totalOvertimeHours = 0;
    let missingPunches = 0;
    const employeeHours: { name: string; regular: number; overtime: number }[] = [];

    for (const emp of activeEmployees) {
      const empPunches = punchesByEmployee.get(emp.id) || [];
      if (empPunches.length === 0) {
        continue;
      }

      const punchRecords = empPunches.map((p) => ({
        id: p.id,
        employeeId: p.employeeId,
        timestamp: p.timestamp,
        type: p.type,
        isManual: p.isManual,
      }));

      const dayGroups = groupPunchesByDay(punchRecords);
      let empTotalHours = 0;

      for (const [, dayPunches] of dayGroups) {
        const dayResult = pairPunchesForDay(dayPunches);
        empTotalHours += dayResult.totalHours;
        if (dayResult.hasIssue) missingPunches++;
      }

      let regularHours: number;
      let overtimeHours: number;

      if (emp.overtimeEnabled && empTotalHours > emp.overtimeThreshold) {
        regularHours = emp.overtimeThreshold;
        overtimeHours = empTotalHours - emp.overtimeThreshold;
      } else {
        regularHours = empTotalHours;
        overtimeHours = 0;
      }

      const effectiveRate = effectiveRates.get(emp.id) ?? emp.payRate;
      const regularPay = regularHours * effectiveRate;
      const overtimePay = overtimeHours * effectiveRate * emp.overtimeMultiplier;

      totalHours += empTotalHours;
      totalCost += regularPay + overtimePay;
      totalOvertimeHours += overtimeHours;

      employeeHours.push({
        name: emp.name || emp.code,
        regular: Math.round(regularHours * 100) / 100,
        overtime: Math.round(overtimeHours * 100) / 100,
      });
    }

    const totalPayouts = payouts
      .filter((p) => p.type !== "PAYMENT" && p.type !== "LOAN_REPAYMENT")
      .reduce((sum, p) => sum + p.amount, 0);

    return NextResponse.json({
      totalHoursThisWeek: Math.round(totalHours * 100) / 100,
      totalCostThisWeek: Math.round(totalCost * 100) / 100,
      activeEmployees: activeEmployees.length,
      overtimeHoursThisWeek: Math.round(totalOvertimeHours * 100) / 100,
      missingPunches,
      totalPayouts: Math.round(totalPayouts * 100) / 100,
      employeeHours,
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
