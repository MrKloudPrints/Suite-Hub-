import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authHelpers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();
    const { amount, type, description, date, method } = body;

    const data: Record<string, unknown> = {};
    if (amount !== undefined) {
      const parsed = parseFloat(amount);
      if (isNaN(parsed) || parsed <= 0) return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
      data.amount = parsed;
    }
    const validTypes = ["ADVANCE", "LOAN", "PAYMENT", "LOAN_REPAYMENT"];
    if (type) {
      if (!validTypes.includes(type)) return NextResponse.json({ error: "Invalid payout type" }, { status: 400 });
      data.type = type;
    }
    if (method !== undefined) data.method = method;
    if (description !== undefined) data.description = description;
    if (date) data.date = new Date(date + "T00:00:00");

    const payout = await prisma.payout.update({
      where: { id },
      data,
      include: {
        employee: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return NextResponse.json(payout);
  } catch (error) {
    console.error("PATCH /api/payouts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update payout" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;
  try {
    const { id } = await params;

    await prisma.payout.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/payouts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete payout" },
      { status: 500 }
    );
  }
}
