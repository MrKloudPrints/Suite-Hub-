import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authHelpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (startDate || endDate) {
    where.date = {};
    if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate);
    if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate + "T23:59:59.999Z");
  }
  if (type) where.type = type;

  const entries = await prisma.cashEntry.findMany({
    where,
    include: { user: { select: { id: true, username: true } } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const { type, amount, registerAmount, depositAmount, changeGiven, category, source, customerName, invoiceNumber, notes, date } = body;

  if (!type || amount === undefined || !date) {
    return NextResponse.json({ error: "Type, amount, and date are required" }, { status: 400 });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  const validTypes = ["CASH_IN", "CASH_OUT", "DEPOSIT", "WITHDRAWAL"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Type must be CASH_IN, CASH_OUT, DEPOSIT, or WITHDRAWAL" }, { status: 400 });
  }

  const entry = await prisma.cashEntry.create({
    data: {
      type,
      amount: parsedAmount,
      registerAmount: parseFloat(registerAmount || 0),
      depositAmount: parseFloat(depositAmount || 0),
      changeGiven: parseFloat(changeGiven || 0),
      category: category || null,
      source: source || "REGISTER",
      customerName: customerName || null,
      invoiceNumber: invoiceNumber || null,
      notes: notes || null,
      date: new Date(date + "T00:00:00.000Z"),
      userId: session!.user!.id!,
    },
    include: { user: { select: { id: true, username: true } } },
  });

  return NextResponse.json(entry, { status: 201 });
}
