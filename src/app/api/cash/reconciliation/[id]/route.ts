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
  const { notes } = body;

  const reconciliation = await prisma.cashReconciliation.update({
    where: { id },
    data: { notes: notes || null },
    include: { user: { select: { id: true, username: true } } },
  });

  return NextResponse.json(reconciliation);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await prisma.cashReconciliation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
