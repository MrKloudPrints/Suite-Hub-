import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authHelpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Record<string, unknown> = {};
  if (startDate || endDate) {
    where.date = {};
    if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate);
    if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate + "T23:59:59.999Z");
  }

  const reconciliations = await prisma.cashReconciliation.findMany({
    where,
    include: { user: { select: { id: true, username: true } } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(reconciliations);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { registerActual, depositActual, notes, date } = body;

  if (registerActual === undefined || depositActual === undefined || !date) {
    return NextResponse.json({ error: "Register actual, deposit actual, and date required" }, { status: 400 });
  }

  // Calculate expected balances from summary logic (UTC midnight to match RegisterReset storage)
  const now = new Date(date);
  const dayOfWeek = now.getDay();
  const mondayLocal = new Date(now);
  mondayLocal.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const monday = new Date(Date.UTC(mondayLocal.getFullYear(), mondayLocal.getMonth(), mondayLocal.getDate()));

  const registerReset = await prisma.registerReset.findUnique({
    where: { weekStart: monday },
  });
  const startingBalance = registerReset?.amount ?? 200;

  // Check for the most recent reconciliation this week up to this date — use its actuals as baseline
  const reconDate = new Date(date + "T00:00:00.000Z");
  const lastRecon = await prisma.cashReconciliation.findFirst({
    where: { date: { gte: monday, lte: reconDate } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  let registerExpected: number;
  let depositExpected: number;
  let entriesFrom: Date;

  if (lastRecon) {
    registerExpected = lastRecon.registerActual;
    depositExpected = lastRecon.depositActual;
    // Only count entries created AFTER the previous reconciliation was saved
    entriesFrom = lastRecon.createdAt;
  } else {
    registerExpected = startingBalance;
    depositExpected = 0;
    entriesFrom = monday;
  }

  const endOfDay = new Date(date + "T23:59:59.999Z");
  const hasRecon = !!lastRecon;

  const entries = await prisma.cashEntry.findMany({
    where: hasRecon
      ? { createdAt: { gt: entriesFrom }, date: { lte: endOfDay } }
      : { date: { gte: entriesFrom, lte: endOfDay } },
  });

  for (const entry of entries) {
    if (entry.type === "CASH_IN") {
      registerExpected += entry.registerAmount;
      depositExpected += entry.depositAmount;
      // If change was given from deposit, reverse the register deduction and take from deposit
      if (entry.changeGiven > 0 && entry.source === "DEPOSIT") {
        registerExpected += entry.changeGiven;
        depositExpected -= entry.changeGiven;
      }
    } else if (entry.type === "CASH_OUT") {
      // Deduct from correct source
      if (entry.source === "DEPOSIT") {
        depositExpected -= entry.amount;
      } else {
        registerExpected -= entry.amount;
      }
    } else if (entry.type === "DEPOSIT") {
      registerExpected -= entry.amount;
      depositExpected += entry.amount;
    } else if (entry.type === "WITHDRAWAL") {
      depositExpected -= entry.amount;
      registerExpected += entry.amount;
    }
  }

  // Subtract non-out-of-pocket expenses from correct source (from baseline forward)
  const expenses = await prisma.expense.findMany({
    where: hasRecon
      ? { createdAt: { gt: entriesFrom }, date: { lte: endOfDay }, outOfPocket: false }
      : { date: { gte: entriesFrom, lte: endOfDay }, outOfPocket: false },
  });
  for (const exp of expenses) {
    if (exp.source === "DEPOSIT") {
      depositExpected -= exp.amount;
    } else {
      registerExpected -= exp.amount;
    }
  }

  registerExpected = Math.round(registerExpected * 100) / 100;
  depositExpected = Math.round(depositExpected * 100) / 100;

  const regActual = parseFloat(registerActual);
  const depActual = parseFloat(depositActual);
  const expectedBalance = registerExpected + depositExpected;
  const actualBalance = regActual + depActual;
  const discrepancy = Math.round((actualBalance - expectedBalance) * 100) / 100;

  const reconciliation = await prisma.cashReconciliation.create({
    data: {
      expectedBalance,
      actualBalance,
      discrepancy,
      registerExpected,
      registerActual: regActual,
      depositExpected,
      depositActual: depActual,
      notes: notes || null,
      date: new Date(date + "T00:00:00.000Z"),
      userId: session!.user!.id!,
    },
    include: { user: { select: { id: true, username: true } } },
  });

  return NextResponse.json(reconciliation, { status: 201 });
}
