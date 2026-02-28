import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authHelpers";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  // Get current week's Monday (UTC midnight to match RegisterReset storage)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayLocal = new Date(now);
  mondayLocal.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const monday = new Date(Date.UTC(mondayLocal.getFullYear(), mondayLocal.getMonth(), mondayLocal.getDate()));

  // Get register reset for this week
  const registerReset = await prisma.registerReset.findUnique({
    where: { weekStart: monday },
  });
  const weeklyStartingBalance = registerReset?.amount ?? 200;

  // Check for the most recent reconciliation this week — use its actuals as baseline
  const lastRecon = await prisma.cashReconciliation.findFirst({
    where: { date: { gte: monday } },
    orderBy: { date: "desc" },
  });

  // Determine baseline: if we have a reconciliation, start from its actuals
  let registerBalance: number;
  let depositBalance: number;
  let entriesFrom: Date;

  if (lastRecon) {
    registerBalance = lastRecon.registerActual;
    depositBalance = lastRecon.depositActual;
    // Only count entries created AFTER the reconciliation was saved
    entriesFrom = lastRecon.createdAt;
  } else {
    registerBalance = weeklyStartingBalance;
    depositBalance = 0;
    entriesFrom = monday;
  }

  // Get today's boundaries (UTC midnight to match entry date storage)
  const todayLocal = new Date();
  const todayStr = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, "0")}-${String(todayLocal.getDate()).padStart(2, "0")}`;
  const todayStart = new Date(todayStr + "T00:00:00.000Z");
  const todayEnd = new Date(todayStr + "T23:59:59.999Z");

  // Get entries from the baseline point forward
  // If we have a recon, filter by createdAt (precise timestamp); otherwise by date (week start)
  const entries = await prisma.cashEntry.findMany({
    where: lastRecon
      ? { createdAt: { gt: entriesFrom } }
      : { date: { gte: entriesFrom } },
  });

  // Get today's expenses (for today totals display) — exclude out-of-pocket since they don't affect cash
  const todayExpenses = await prisma.expense.findMany({
    where: { date: { gte: todayStart, lte: todayEnd }, outOfPocket: false },
  });

  let todayCashIn = 0;
  let todayCashOut = 0;

  for (const entry of entries) {
    const isToday = entry.date >= todayStart && entry.date <= todayEnd;

    if (entry.type === "CASH_IN") {
      registerBalance += entry.registerAmount;
      depositBalance += entry.depositAmount;
      if (entry.changeGiven > 0 && entry.source === "DEPOSIT") {
        registerBalance += entry.changeGiven;
        depositBalance -= entry.changeGiven;
      }
      if (isToday) todayCashIn += entry.amount - entry.changeGiven;
    } else if (entry.type === "CASH_OUT") {
      if (entry.source === "DEPOSIT") {
        depositBalance -= entry.amount;
      } else {
        registerBalance -= entry.amount;
      }
      if (isToday) todayCashOut += entry.amount;
    } else if (entry.type === "DEPOSIT") {
      registerBalance -= entry.amount;
      depositBalance += entry.amount;
    } else if (entry.type === "WITHDRAWAL") {
      depositBalance -= entry.amount;
      registerBalance += entry.amount;
    }
  }

  // Subtract expenses from correct source (from baseline point forward)
  const weekExpenses = await prisma.expense.findMany({
    where: lastRecon
      ? { createdAt: { gt: entriesFrom }, outOfPocket: false }
      : { date: { gte: entriesFrom }, outOfPocket: false },
  });
  for (const exp of weekExpenses) {
    if (exp.source === "DEPOSIT") {
      depositBalance -= exp.amount;
    } else {
      registerBalance -= exp.amount;
    }
  }

  const todayExpenseTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

  return NextResponse.json({
    registerBalance: Math.round(registerBalance * 100) / 100,
    depositBalance: Math.round(depositBalance * 100) / 100,
    todayCashIn: Math.round(todayCashIn * 100) / 100,
    todayCashOut: Math.round(todayCashOut * 100) / 100,
    todayExpenses: Math.round(todayExpenseTotal * 100) / 100,
    weeklyStartingBalance,
    lastReconciliation: lastRecon
      ? {
          date: lastRecon.date.toISOString(),
          registerActual: lastRecon.registerActual,
          depositActual: lastRecon.depositActual,
        }
      : null,
  });
}
