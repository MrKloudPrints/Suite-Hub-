import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/authHelpers";

// GET /api/punches — Query punches with filters: employeeId, startDate, endDate
export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: Record<string, unknown> = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (startDate || endDate) {
      const timestampFilter: Record<string, Date> = {};
      if (startDate) {
        timestampFilter.gte = new Date(startDate + "T00:00:00");
      }
      if (endDate) {
        timestampFilter.lte = new Date(endDate + "T23:59:59.999");
      }
      where.timestamp = timestampFilter;
    }

    const punches = await prisma.punch.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { timestamp: "asc" },
    });

    return NextResponse.json(punches);
  } catch (error) {
    console.error("GET /api/punches error:", error);
    return NextResponse.json(
      { error: "Failed to fetch punches" },
      { status: 500 }
    );
  }
}

// POST /api/punches — Add a manual punch
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  try {
    const body = await request.json();
    const { employeeId, timestamp, type } = body;

    if (!employeeId || !timestamp) {
      return NextResponse.json(
        { error: "employeeId and timestamp are required" },
        { status: 400 }
      );
    }

    const punchType = type || "UNKNOWN";

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Double-punch prevention: reject if another punch exists within 60 seconds
    const MIN_PUNCH_GAP_SECONDS = 60;
    const punchTime = new Date(timestamp);
    const tooClose = await prisma.punch.findFirst({
      where: {
        employeeId,
        id: { not: undefined }, // just uses index
        timestamp: {
          gte: new Date(punchTime.getTime() - MIN_PUNCH_GAP_SECONDS * 1000),
          lte: new Date(punchTime.getTime() + MIN_PUNCH_GAP_SECONDS * 1000),
        },
      },
    });
    if (tooClose) {
      return NextResponse.json(
        { error: `A punch already exists within ${MIN_PUNCH_GAP_SECONDS} seconds of this time` },
        { status: 409 }
      );
    }

    const punch = await prisma.punch.create({
      data: {
        employeeId,
        timestamp: punchTime,
        type: punchType,
        isManual: true,
        source: "MANUAL",
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

    return NextResponse.json(punch, { status: 201 });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") {
      return NextResponse.json(
        { error: "A punch already exists for this employee at this timestamp" },
        { status: 409 }
      );
    }
    console.error("POST /api/punches error:", error);
    return NextResponse.json(
      { error: "Failed to create punch" },
      { status: 500 }
    );
  }
}
