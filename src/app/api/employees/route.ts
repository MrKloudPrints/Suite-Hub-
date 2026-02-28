import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/authHelpers";

// GET /api/employees — List all employees with optional ?active=true filter
export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const activeFilter = searchParams.get("active");

    const where: Record<string, unknown> = {};
    if (activeFilter === "true") {
      where.active = true;
    } else if (activeFilter === "false") {
      where.active = false;
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        punches: {
          select: {
            id: true,
            timestamp: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Map employees to include punch count and issue count
    const result = employees.map((emp) => {
      // Group punches by day to find issues (odd punch counts)
      const dayMap = new Map<string, number>();
      for (const punch of emp.punches) {
        const dateKey = new Date(punch.timestamp).toISOString().split("T")[0];
        dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + 1);
      }

      let issueCount = 0;
      for (const [, count] of dayMap) {
        if (count % 2 !== 0) {
          issueCount++;
        }
      }

      return {
        id: emp.id,
        code: emp.code,
        name: emp.name,
        payRate: emp.payRate,
        overtimeEnabled: emp.overtimeEnabled,
        overtimeThreshold: emp.overtimeThreshold,
        overtimeMultiplier: emp.overtimeMultiplier,
        active: emp.active,
        totalPunches: emp.punches.length,
        issueCount,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/employees error:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}

// POST /api/employees — Create a new employee
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  try {
    const body = await request.json();
    const {
      code,
      name,
      payRate,
      overtimeEnabled,
      overtimeThreshold,
      overtimeMultiplier,
    } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Employee code is required" },
        { status: 400 }
      );
    }

    if (payRate !== undefined && (typeof payRate !== "number" || isNaN(payRate) || payRate < 0)) {
      return NextResponse.json(
        { error: "Pay rate must be a valid non-negative number" },
        { status: 400 }
      );
    }

    // Check for duplicate code
    const existing = await prisma.employee.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { error: `Employee with code "${code}" already exists` },
        { status: 409 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        code,
        name: name ?? "",
        payRate: payRate ?? 0,
        overtimeEnabled: overtimeEnabled ?? false,
        overtimeThreshold: overtimeThreshold ?? 40,
        overtimeMultiplier: overtimeMultiplier ?? 1.5,
      },
    });

    // Seed initial pay rate history record
    await prisma.payRateHistory.create({
      data: {
        employeeId: employee.id,
        payRate: employee.payRate,
        effectiveDate: new Date(),
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error("POST /api/employees error:", error);
    return NextResponse.json(
      { error: "Failed to create employee" },
      { status: 500 }
    );
  }
}
