import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authHelpers";

// PATCH /api/punches/[id] — Edit a punch's timestamp
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();
    const { timestamp } = body;

    if (!timestamp) {
      return NextResponse.json(
        { error: "timestamp is required" },
        { status: 400 }
      );
    }

    const punch = await prisma.punch.update({
      where: { id },
      data: {
        timestamp: new Date(timestamp),
      },
      include: {
        employee: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(punch);
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2025") {
      return NextResponse.json(
        { error: "Punch not found" },
        { status: 404 }
      );
    }
    if (prismaError.code === "P2002") {
      return NextResponse.json(
        { error: "A punch already exists for this employee at the new timestamp" },
        { status: 409 }
      );
    }
    console.error("PATCH /api/punches/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update punch" },
      { status: 500 }
    );
  }
}

// DELETE /api/punches/[id] — Delete a punch
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;
  try {
    const { id } = await params;

    await prisma.punch.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2025") {
      return NextResponse.json(
        { error: "Punch not found" },
        { status: 404 }
      );
    }
    console.error("DELETE /api/punches/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete punch" },
      { status: 500 }
    );
  }
}
