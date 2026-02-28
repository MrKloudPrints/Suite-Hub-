import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authHelpers";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const resets = await prisma.registerReset.findMany({
    orderBy: { weekStart: "desc" },
    take: 10,
  });

  return NextResponse.json(resets);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { amount, weekStart, notes } = body;

  if (amount === undefined || !weekStart) {
    return NextResponse.json({ error: "Amount and weekStart required" }, { status: 400 });
  }

  // Ensure UTC midnight to match how summary/reconciliation/ledger query it
  const weekStartDate = new Date(weekStart + "T00:00:00.000Z");

  const reset = await prisma.registerReset.upsert({
    where: { weekStart: weekStartDate },
    update: { amount: parseFloat(amount), notes: notes || null },
    create: {
      amount: parseFloat(amount),
      weekStart: weekStartDate,
      notes: notes || null,
    },
  });

  return NextResponse.json(reset);
}
