import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authHelpers";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};
  if (startDate || endDate) {
    where.date = {};
    if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate);
    if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate + "T23:59:59.999Z");
  }
  if (category) where.category = category;

  const expenses = await prisma.expense.findMany({
    where,
    include: { user: { select: { id: true, username: true } } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const formData = await req.formData();
    const amount = formData.get("amount") as string;
    const description = formData.get("description") as string;
    const category = (formData.get("category") as string) || "General";
    const source = (formData.get("source") as string) || "REGISTER";
    const paidByName = (formData.get("paidByName") as string) || "";
    const outOfPocket = formData.get("outOfPocket") === "true";
    const date = formData.get("date") as string;
    const receipt = formData.get("receipt") as File | null;

    if (!amount || !description || !date) {
      return NextResponse.json({ error: "Amount, description, and date are required" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    let receiptPath: string | null = null;

    if (receipt && receipt.size > 0) {
      const uploadDir = path.join(process.cwd(), "public/uploads/receipts");
      await mkdir(uploadDir, { recursive: true });
      const ext = path.extname(receipt.name) || ".jpg";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      const filePath = path.join(uploadDir, filename);
      const buffer = Buffer.from(await receipt.arrayBuffer());
      await writeFile(filePath, buffer);
      receiptPath = `/uploads/receipts/${filename}`;
    }

    const expense = await prisma.expense.create({
      data: {
        amount: parsedAmount,
        description,
        category,
        source,
        paidByName,
        outOfPocket,
        receiptPath,
        date: new Date(date + "T00:00:00.000Z"),
        userId: session!.user!.id!,
      },
      include: { user: { select: { id: true, username: true } } },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    console.error("POST /api/cash/expenses error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create expense" }, { status: 500 });
  }
}
