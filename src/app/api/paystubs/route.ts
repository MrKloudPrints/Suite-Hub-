import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startOfWeek, endOfWeek, format, eachDayOfInterval } from "date-fns";
import { groupPunchesByDay, pairPunchesForDay } from "@/lib/punchPairing";
import type { PaystubData } from "@/types";
import { requireAuth } from "@/lib/authHelpers";
import { getEffectivePayRates } from "@/lib/payRateHistory";

export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const weekStartParam = searchParams.get("weekStart");

    let weekStartDate: Date;
    if (weekStartParam) {
      weekStartDate = startOfWeek(new Date(weekStartParam + "T00:00:00"), { weekStartsOn: 1 });
    } else {
      weekStartDate = startOfWeek(new Date(), { weekStartsOn: 1 });
    }
    const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });

    const employeeWhere: Record<string, unknown> = { active: true };
    if (employeeId) {
      employeeWhere.id = employeeId;
      delete employeeWhere.active;
    }

    const employees = await prisma.employee.findMany({ where: employeeWhere });

    if (employees.length === 0) {
      return NextResponse.json([]);
    }

    const employeeIds = employees.map((e) => e.id);

    // Fetch punches and payouts for the week
    const [punches, payouts] = await Promise.all([
      prisma.punch.findMany({
        where: {
          employeeId: { in: employeeIds },
          timestamp: { gte: weekStartDate, lte: weekEndDate },
        },
        orderBy: { timestamp: "asc" },
      }),
      prisma.payout.findMany({
        where: {
          employeeId: { in: employeeIds },
          date: { gte: weekStartDate, lte: weekEndDate },
        },
        orderBy: { date: "asc" },
      }),
    ]);

    // Prior balance only tracks from Feb 16, 2026 onward
    const priorBalanceFloor = new Date("2026-02-16T00:00:00");

    // Fetch all prior payouts (PAYMENT type) to compute prior unpaid balance
    const priorPayouts = await prisma.payout.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: priorBalanceFloor, lt: weekStartDate },
      },
      orderBy: { date: "asc" },
    });

    // Fetch all prior punches to compute prior net pay per week
    const priorPunches = await prisma.punch.findMany({
      where: {
        employeeId: { in: employeeIds },
        timestamp: { gte: priorBalanceFloor, lt: weekStartDate },
      },
      orderBy: { timestamp: "asc" },
    });

    const punchesByEmployee = new Map<string, typeof punches>();
    for (const punch of punches) {
      if (!punchesByEmployee.has(punch.employeeId)) {
        punchesByEmployee.set(punch.employeeId, []);
      }
      punchesByEmployee.get(punch.employeeId)!.push(punch);
    }

    const payoutsByEmployee = new Map<string, typeof payouts>();
    for (const payout of payouts) {
      if (!payoutsByEmployee.has(payout.employeeId)) {
        payoutsByEmployee.set(payout.employeeId, []);
      }
      payoutsByEmployee.get(payout.employeeId)!.push(payout);
    }

    const allDays = eachDayOfInterval({ start: weekStartDate, end: weekEndDate });

    // Batch fetch effective pay rates for this week
    const currentWeekRates = await getEffectivePayRates(employeeIds, weekStartDate);

    // Pre-fetch all pay rate history for prior-week calculations
    const allPayRateHistory = await prisma.payRateHistory.findMany({
      where: { employeeId: { in: employeeIds } },
      orderBy: { effectiveDate: "desc" },
      select: { employeeId: true, payRate: true, effectiveDate: true },
    });

    // Helper: find effective rate from pre-fetched history
    const getHistoricalRate = (empId: string, date: Date): number | null => {
      const record = allPayRateHistory.find(
        (r) => r.employeeId === empId && r.effectiveDate <= date
      );
      return record?.payRate ?? null;
    };

    const paystubs: PaystubData[] = [];

    for (const emp of employees) {
      const empPunches = punchesByEmployee.get(emp.id) || [];
      if (empPunches.length === 0) continue;
      const empPayouts = payoutsByEmployee.get(emp.id) || [];

      const punchRecords = empPunches.map((p) => ({
        id: p.id,
        employeeId: p.employeeId,
        timestamp: p.timestamp,
        type: p.type,
        isManual: p.isManual,
      }));

      const dayGroups = groupPunchesByDay(punchRecords);

      const dailyBreakdown = allDays.map((day) => {
        const dateKey = format(day, "yyyy-MM-dd");
        const dayPunches = dayGroups.get(dateKey);

        if (!dayPunches || dayPunches.length === 0) {
          return {
            date: dateKey,
            dayOfWeek: format(day, "EEEE"),
            pairs: [] as { clockIn: string; clockOut: string; hours: number }[],
            dayTotal: 0,
          };
        }

        const dayResult = pairPunchesForDay(dayPunches);
        return {
          date: dateKey,
          dayOfWeek: format(day, "EEEE"),
          pairs: dayResult.pairs.map((pair) => ({
            clockIn: new Date(pair.clockIn.timestamp).toISOString(),
            clockOut: pair.clockOut
              ? new Date(pair.clockOut.timestamp).toISOString()
              : "",
            hours: Math.round(pair.hours * 100) / 100,
          })),
          dayTotal: Math.round(dayResult.totalHours * 100) / 100,
        };
      });

      const totalHours = dailyBreakdown.reduce((sum, d) => sum + d.dayTotal, 0);

      let regularHours: number;
      let overtimeHours: number;

      if (emp.overtimeEnabled && totalHours > emp.overtimeThreshold) {
        regularHours = emp.overtimeThreshold;
        overtimeHours = totalHours - emp.overtimeThreshold;
      } else {
        regularHours = totalHours;
        overtimeHours = 0;
      }

      const effectiveRate = currentWeekRates.get(emp.id) ?? emp.payRate;
      const regularPay = regularHours * effectiveRate;
      const overtimePay = overtimeHours * effectiveRate * emp.overtimeMultiplier;
      const grossPay = regularPay + overtimePay;
      const totalPayouts = empPayouts
        .filter((p) => p.type !== "PAYMENT" && p.type !== "LOAN_REPAYMENT")
        .reduce((sum, p) => sum + p.amount, 0);
      const netPay = grossPay - totalPayouts;

      // Payments made this week
      const totalPaid = empPayouts
        .filter((p) => p.type === "PAYMENT")
        .reduce((sum, p) => sum + p.amount, 0);
      const balanceDue = Math.round((netPay - totalPaid) * 100) / 100;

      // Compute prior unpaid balance: for each prior week with punches,
      // calculate that week's net pay minus payments made in that week
      const empPriorPunches = priorPunches.filter((p) => p.employeeId === emp.id);
      const empPriorPayouts = priorPayouts.filter((p) => p.employeeId === emp.id);

      let priorBalance = 0;
      if (empPriorPunches.length > 0) {
        // Group prior punches by week (Monday-based)
        const weekGroups = new Map<string, typeof empPriorPunches>();
        for (const p of empPriorPunches) {
          const pDate = new Date(p.timestamp);
          const weekMon = startOfWeek(pDate, { weekStartsOn: 1 });
          const weekKey = format(weekMon, "yyyy-MM-dd");
          if (!weekGroups.has(weekKey)) weekGroups.set(weekKey, []);
          weekGroups.get(weekKey)!.push(p);
        }

        for (const [weekKey, weekPunches] of weekGroups) {
          const wStart = new Date(weekKey + "T00:00:00");
          const wEnd = endOfWeek(wStart, { weekStartsOn: 1 });

          // Calculate that week's hours
          const punchRecords = weekPunches.map((p) => ({
            id: p.id, employeeId: p.employeeId,
            timestamp: p.timestamp, type: p.type, isManual: p.isManual,
          }));
          const dayGrps = groupPunchesByDay(punchRecords);
          let weekHours = 0;
          for (const dayP of dayGrps.values()) {
            const dr = pairPunchesForDay(dayP);
            weekHours += dr.totalHours;
          }

          let wRegular: number, wOvertime: number;
          if (emp.overtimeEnabled && weekHours > emp.overtimeThreshold) {
            wRegular = emp.overtimeThreshold;
            wOvertime = weekHours - emp.overtimeThreshold;
          } else {
            wRegular = weekHours;
            wOvertime = 0;
          }

          const wEffectiveRate = getHistoricalRate(emp.id, wStart) ?? emp.payRate;
          const wGross = wRegular * wEffectiveRate + wOvertime * wEffectiveRate * emp.overtimeMultiplier;
          const wDeductions = empPriorPayouts
            .filter((p) => p.type !== "PAYMENT" && p.type !== "LOAN_REPAYMENT" && p.date >= wStart && p.date <= wEnd)
            .reduce((s, p) => s + p.amount, 0);
          const wNet = wGross - wDeductions;
          const wPaid = empPriorPayouts
            .filter((p) => p.type === "PAYMENT" && p.date >= wStart && p.date <= wEnd)
            .reduce((s, p) => s + p.amount, 0);

          const weekOwed = Math.max(0, wNet - wPaid);
          priorBalance += weekOwed;
        }
        priorBalance = Math.round(priorBalance * 100) / 100;
      }

      paystubs.push({
        employee: {
          name: emp.name,
          code: emp.code,
          payRate: emp.payRate,
        },
        period: {
          start: format(weekStartDate, "yyyy-MM-dd"),
          end: format(weekEndDate, "yyyy-MM-dd"),
          label: `${format(weekStartDate, "MMM d")} - ${format(weekEndDate, "MMM d, yyyy")}`,
        },
        dailyBreakdown,
        payouts: empPayouts.map((p) => ({
          date: format(p.date, "yyyy-MM-dd"),
          type: p.type,
          description: p.description,
          amount: p.amount,
        })),
        summary: {
          totalHours: Math.round(totalHours * 100) / 100,
          regularHours: Math.round(regularHours * 100) / 100,
          overtimeHours: Math.round(overtimeHours * 100) / 100,
          regularPay: Math.round(regularPay * 100) / 100,
          overtimePay: Math.round(overtimePay * 100) / 100,
          grossPay: Math.round(grossPay * 100) / 100,
          totalPayouts: Math.round(totalPayouts * 100) / 100,
          netPay: Math.round(netPay * 100) / 100,
          payRate: effectiveRate,
          overtimeRate: Math.round(effectiveRate * emp.overtimeMultiplier * 100) / 100,
          overtimeMultiplier: emp.overtimeMultiplier,
          totalPaid: Math.round(totalPaid * 100) / 100,
          balanceDue: Math.max(0, balanceDue),
          priorBalance,
        },
      });
    }

    return NextResponse.json(paystubs);
  } catch (error) {
    console.error("GET /api/paystubs error:", error);
    return NextResponse.json(
      { error: "Failed to generate paystubs" },
      { status: 500 }
    );
  }
}
