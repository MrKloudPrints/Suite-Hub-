import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authHelpers";

interface LedgerRow {
  id: string;
  date: string;
  type: "CASH_IN" | "CASH_OUT" | "DEPOSIT" | "WITHDRAWAL" | "EXPENSE";
  description: string;
  category: string | null;
  source: string;
  registerChange: number;
  depositChange: number;
  registerBalance: number;
  depositBalance: number;
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  // Get the week's Monday for starting balance (UTC midnight to match RegisterReset storage)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayLocal = new Date(now);
  mondayLocal.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const monday = new Date(Date.UTC(mondayLocal.getFullYear(), mondayLocal.getMonth(), mondayLocal.getDate()));

  const registerReset = await prisma.registerReset.findUnique({
    where: { weekStart: monday },
  });
  const startingRegister = registerReset?.amount ?? 200;

  // Check for the most recent reconciliation this week — use its actuals as baseline
  const lastRecon = await prisma.cashReconciliation.findFirst({
    where: { date: { gte: monday } },
    orderBy: { date: "desc" },
  });

  let baseRegister: number;
  let baseDeposit: number;
  let baselineFrom: Date;

  if (lastRecon) {
    baseRegister = lastRecon.registerActual;
    baseDeposit = lastRecon.depositActual;
    // Only count entries created AFTER the reconciliation was saved
    baselineFrom = lastRecon.createdAt;
  } else {
    baseRegister = startingRegister;
    baseDeposit = 0;
    baselineFrom = monday;
  }

  // Determine date range
  const dateFrom = startDate ? new Date(startDate + "T00:00:00") : (lastRecon ? new Date() : baselineFrom);
  const dateTo = endDate ? new Date(endDate + "T23:59:59.999") : new Date();

  // Compute balance up to dateFrom if needed
  let registerBalance = baseRegister;
  let depositBalance = baseDeposit;

  // When recon-based, compute prior balance using createdAt; otherwise use date
  const hasRecon = !!lastRecon;
  if (hasRecon) {
    // All entries after recon but before the display date range
    const priorEntries = await prisma.cashEntry.findMany({
      where: { createdAt: { gt: baselineFrom }, date: { lt: dateFrom } },
      orderBy: { date: "asc" },
    });
    const priorExpenses = await prisma.expense.findMany({
      where: { createdAt: { gt: baselineFrom }, date: { lt: dateFrom }, outOfPocket: false },
      orderBy: { date: "asc" },
    });

    for (const entry of priorEntries) {
      if (entry.type === "CASH_IN") {
        registerBalance += entry.registerAmount;
        depositBalance += entry.depositAmount;
        if (entry.changeGiven > 0 && entry.source === "DEPOSIT") {
          registerBalance += entry.changeGiven;
          depositBalance -= entry.changeGiven;
        }
      } else if (entry.type === "CASH_OUT") {
        if (entry.source === "DEPOSIT") depositBalance -= entry.amount;
        else registerBalance -= entry.amount;
      } else if (entry.type === "DEPOSIT") {
        registerBalance -= entry.amount;
        depositBalance += entry.amount;
      } else if (entry.type === "WITHDRAWAL") {
        depositBalance -= entry.amount;
        registerBalance += entry.amount;
      }
    }
    for (const exp of priorExpenses) {
      if (exp.source === "DEPOSIT") depositBalance -= exp.amount;
      else registerBalance -= exp.amount;
    }
  } else if (dateFrom > baselineFrom) {
    const priorEntries = await prisma.cashEntry.findMany({
      where: { date: { gte: baselineFrom, lt: dateFrom } },
      orderBy: { date: "asc" },
    });
    const priorExpenses = await prisma.expense.findMany({
      where: { date: { gte: baselineFrom, lt: dateFrom }, outOfPocket: false },
      orderBy: { date: "asc" },
    });

    for (const entry of priorEntries) {
      if (entry.type === "CASH_IN") {
        registerBalance += entry.registerAmount;
        depositBalance += entry.depositAmount;
        if (entry.changeGiven > 0 && entry.source === "DEPOSIT") {
          registerBalance += entry.changeGiven;
          depositBalance -= entry.changeGiven;
        }
      } else if (entry.type === "CASH_OUT") {
        if (entry.source === "DEPOSIT") depositBalance -= entry.amount;
        else registerBalance -= entry.amount;
      } else if (entry.type === "DEPOSIT") {
        registerBalance -= entry.amount;
        depositBalance += entry.amount;
      } else if (entry.type === "WITHDRAWAL") {
        depositBalance -= entry.amount;
        registerBalance += entry.amount;
      }
    }
    for (const exp of priorExpenses) {
      if (exp.source === "DEPOSIT") depositBalance -= exp.amount;
      else registerBalance -= exp.amount;
    }
  }

  // Get entries and expenses in the date range
  const entries = await prisma.cashEntry.findMany({
    where: { date: { gte: dateFrom, lte: dateTo } },
    include: { user: { select: { username: true } } },
    orderBy: { date: "asc" },
  });

  const expenses = await prisma.expense.findMany({
    where: { date: { gte: dateFrom, lte: dateTo }, outOfPocket: false },
    include: { user: { select: { username: true } } },
    orderBy: { date: "asc" },
  });

  // Merge and sort by date
  type RawItem = {
    id: string;
    date: Date;
    kind: "entry" | "expense";
    entry?: typeof entries[number];
    expense?: typeof expenses[number];
  };

  const items: RawItem[] = [
    ...entries.map((e) => ({ id: e.id, date: e.date, kind: "entry" as const, entry: e })),
    ...expenses.map((e) => ({ id: e.id, date: e.date, kind: "expense" as const, expense: e })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const ledger: LedgerRow[] = [];

  for (const item of items) {
    let registerChange = 0;
    let depositChange = 0;
    let type: LedgerRow["type"];
    let description = "";
    let category: string | null = null;
    let source = "REGISTER";

    if (item.kind === "entry" && item.entry) {
      const e = item.entry;
      type = e.type as LedgerRow["type"];
      description = [e.customerName, e.invoiceNumber, e.notes].filter(Boolean).join(" | ") || e.type;
      category = e.category;
      source = e.source;

      if (e.type === "CASH_IN") {
        registerChange = e.registerAmount;
        depositChange = e.depositAmount;
        if (e.changeGiven > 0 && e.source === "DEPOSIT") {
          registerChange += e.changeGiven;
          depositChange -= e.changeGiven;
        }
      } else if (e.type === "CASH_OUT") {
        if (e.source === "DEPOSIT") depositChange = -e.amount;
        else registerChange = -e.amount;
      } else if (e.type === "DEPOSIT") {
        registerChange = -e.amount;
        depositChange = e.amount;
      } else if (e.type === "WITHDRAWAL") {
        registerChange = e.amount;
        depositChange = -e.amount;
      }
    } else if (item.kind === "expense" && item.expense) {
      const exp = item.expense;
      type = "EXPENSE";
      description = exp.description;
      category = exp.category;
      source = exp.source;

      if (exp.source === "DEPOSIT") depositChange = -exp.amount;
      else registerChange = -exp.amount;
    } else {
      continue;
    }

    registerBalance += registerChange;
    depositBalance += depositChange;

    ledger.push({
      id: item.id,
      date: item.date.toISOString(),
      type,
      description,
      category,
      source,
      registerChange: Math.round(registerChange * 100) / 100,
      depositChange: Math.round(depositChange * 100) / 100,
      registerBalance: Math.round(registerBalance * 100) / 100,
      depositBalance: Math.round(depositBalance * 100) / 100,
    });
  }

  return NextResponse.json({
    startingRegister: Math.round(baseRegister * 100) / 100,
    startingDeposit: Math.round(baseDeposit * 100) / 100,
    ledger,
  });
}
