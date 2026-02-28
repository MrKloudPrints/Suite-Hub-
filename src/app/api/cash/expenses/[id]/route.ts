import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authHelpers";
import { unlink } from "fs/promises";
import path from "path";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { amount, description, category, source, paidByName, outOfPocket, reimbursed, date } = body;

  const data: Record<string, unknown> = {};
  if (amount !== undefined) data.amount = parseFloat(amount);
  if (description !== undefined) data.description = description;
  if (category !== undefined) data.category = category;
  if (source !== undefined) data.source = source;
  if (paidByName !== undefined) data.paidByName = paidByName;
  if (outOfPocket !== undefined) data.outOfPocket = outOfPocket;
  if (reimbursed !== undefined) data.reimbursed = reimbursed;
  if (date) data.date = new Date(date + "T00:00:00");

  const expense = await prisma.expense.update({
    where: { id },
    data,
    include: { user: { select: { id: true, username: true } } },
  });

  return NextResponse.json(expense);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  // Get expense to check for receipt file
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (expense?.receiptPath) {
    try {
      const filePath = path.join(process.cwd(), "public", expense.receiptPath);
      await unlink(filePath);
    } catch {
      // File may not exist, continue
    }
  }

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
