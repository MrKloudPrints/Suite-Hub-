import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authHelpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { type, amount, registerAmount, depositAmount, changeGiven, category, source, customerName, invoiceNumber, notes, date } = body;

  const data: Record<string, unknown> = {};
  if (type) data.type = type;
  if (amount !== undefined) data.amount = parseFloat(amount);
  if (registerAmount !== undefined) data.registerAmount = parseFloat(registerAmount);
  if (depositAmount !== undefined) data.depositAmount = parseFloat(depositAmount);
  if (changeGiven !== undefined) data.changeGiven = parseFloat(changeGiven);
  if (category !== undefined) data.category = category || null;
  if (source !== undefined) data.source = source;
  if (customerName !== undefined) data.customerName = customerName || null;
  if (invoiceNumber !== undefined) data.invoiceNumber = invoiceNumber || null;
  if (notes !== undefined) data.notes = notes || null;
  if (date) data.date = new Date(date + "T00:00:00");

  const entry = await prisma.cashEntry.update({
    where: { id },
    data,
    include: { user: { select: { id: true, username: true } } },
  });

  return NextResponse.json(entry);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await prisma.cashEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
