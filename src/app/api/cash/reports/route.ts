import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authHelpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate + "T23:59:59.999Z");

  const [entries, expenses] = await Promise.all([
    prisma.cashEntry.findMany({
      where: { date: { gte: start, lte: end } },
      include: { user: { select: { id: true, username: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      include: { user: { select: { id: true, username: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  // Aggregate by day
  const dailyData: Record<string, { date: string; cashIn: number; cashOut: number; expenses: number }> = {};

  for (const entry of entries) {
    const day = entry.date.toISOString().split("T")[0];
    if (!dailyData[day]) dailyData[day] = { date: day, cashIn: 0, cashOut: 0, expenses: 0 };
    if (entry.type === "CASH_IN") dailyData[day].cashIn += entry.amount;
    else if (entry.type === "CASH_OUT") dailyData[day].cashOut += entry.amount;
  }

  for (const expense of expenses) {
    const day = expense.date.toISOString().split("T")[0];
    if (!dailyData[day]) dailyData[day] = { date: day, cashIn: 0, cashOut: 0, expenses: 0 };
    dailyData[day].expenses += expense.amount;
  }

  // Expense breakdown by category
  const categoryBreakdown: Record<string, number> = {};
  for (const expense of expenses) {
    categoryBreakdown[expense.category] = (categoryBreakdown[expense.category] || 0) + expense.amount;
  }

  // Totals
  const totalCashIn = entries.filter((e) => e.type === "CASH_IN").reduce((s, e) => s + e.amount, 0);
  const totalCashOut = entries.filter((e) => e.type === "CASH_OUT").reduce((s, e) => s + e.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalDeposits = entries.filter((e) => e.type === "DEPOSIT").reduce((s, e) => s + e.amount, 0);

  return NextResponse.json({
    dailyData: Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date)),
    categoryBreakdown,
    totals: {
      cashIn: Math.round(totalCashIn * 100) / 100,
      cashOut: Math.round(totalCashOut * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
      deposits: Math.round(totalDeposits * 100) / 100,
      netCashFlow: Math.round((totalCashIn - totalCashOut - totalExpenses) * 100) / 100,
    },
    entries,
    expenses,
  });
}
