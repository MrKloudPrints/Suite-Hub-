import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/authHelpers";

// GET /api/employees/[id] — Single employee with recent punch data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;
  try {
    const { id } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        punches: {
          orderBy: { timestamp: "desc" },
          take: 50,
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error("GET /api/employees/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch employee" },
      { status: 500 }
    );
  }
}

// PATCH /api/employees/[id] — Update employee fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();

    const allowedFields = [
      "name",
      "payRate",
      "overtimeEnabled",
      "overtimeThreshold",
      "overtimeMultiplier",
      "active",
    ];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    // Validate numeric fields
    if (data.payRate !== undefined && (typeof data.payRate !== "number" || isNaN(data.payRate as number) || (data.payRate as number) < 0)) {
      return NextResponse.json({ error: "Pay rate must be a valid non-negative number" }, { status: 400 });
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // If pay rate is changing, record a new PayRateHistory entry
    if (data.payRate !== undefined) {
      const current = await prisma.employee.findUnique({
        where: { id },
        select: { payRate: true },
      });
      if (current && current.payRate !== data.payRate) {
        await prisma.payRateHistory.create({
          data: {
            employeeId: id,
            payRate: data.payRate as number,
            effectiveDate: new Date(),
          },
        });
      }
    }

    const employee = await prisma.employee.update({
      where: { id },
      data,
    });

    return NextResponse.json(employee);
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2025") {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }
    console.error("PATCH /api/employees/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update employee" },
      { status: 500 }
    );
  }
}

// DELETE /api/employees/[id] — Delete employee and cascade punches
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;
  try {
    const { id } = await params;

    // The schema has onDelete: Cascade, so deleting the employee
    // will automatically delete associated punches
    await prisma.employee.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2025") {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }
    console.error("DELETE /api/employees/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete employee" },
      { status: 500 }
    );
  }
}
