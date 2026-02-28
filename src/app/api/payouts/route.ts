import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdminOrManager } from "@/lib/authHelpers";

export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: Record<string, unknown> = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate + "T00:00:00");
      if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59.999");
      where.date = dateFilter;
    }

    const payouts = await prisma.payout.findMany({
      where,
      include: {
        employee: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(payouts);
  } catch (error) {
    console.error("GET /api/payouts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payouts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdminOrManager();
  if (error) return error;
  try {
    const body = await request.json();
    const { employeeId, amount, type, method, description, date } = body;

    if (!employeeId || amount === undefined || !type || !date) {
      return NextResponse.json(
        { error: "employeeId, amount, type, and date are required" },
        { status: 400 }
      );
    }

    if (type !== "ADVANCE" && type !== "LOAN" && type !== "PAYMENT" && type !== "LOAN_REPAYMENT") {
      return NextResponse.json(
        { error: "type must be 'ADVANCE', 'LOAN', 'PAYMENT', or 'LOAN_REPAYMENT'" },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const payout = await prisma.payout.create({
      data: {
        employeeId,
        amount: parseFloat(amount),
        type,
        method: method || null,
        description: description || "",
        date: new Date(date + "T00:00:00"),
      },
      include: {
        employee: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return NextResponse.json(payout, { status: 201 });
  } catch (error) {
    console.error("POST /api/payouts error:", error);
    return NextResponse.json(
      { error: "Failed to create payout" },
      { status: 500 }
    );
  }
}
