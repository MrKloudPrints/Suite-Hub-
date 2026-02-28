import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseAttlog } from "@/lib/parseAttlog";
import { requireAdmin } from "@/lib/authHelpers";

// POST /api/import — Import attendance log file
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded. Provide a 'file' field." },
        { status: 400 }
      );
    }

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const fileContent = await file.text();
    const rawPunches = parseAttlog(fileContent);

    if (rawPunches.length === 0) {
      return NextResponse.json(
        { error: "No valid punch records found in the file" },
        { status: 400 }
      );
    }

    // Gather unique employee codes
    const uniqueCodes = [...new Set(rawPunches.map((p) => p.employeeCode))];

    // Fetch existing employees by code
    const existingEmployees = await prisma.employee.findMany({
      where: { code: { in: uniqueCodes } },
      select: { id: true, code: true },
    });
    const codeToId = new Map(existingEmployees.map((e) => [e.code, e.id]));

    // Create missing employees
    let newEmployees = 0;
    for (const code of uniqueCodes) {
      if (!codeToId.has(code)) {
        const emp = await prisma.employee.create({
          data: {
            code,
            name: `Employee ${code}`,
          },
        });
        codeToId.set(code, emp.id);
        newEmployees++;
      }
    }

    // Filter out double-punches: skip any punch within 60s of the previous
    // one for the same employee (e.g. thumb scanned twice on biometric reader)
    const MIN_PUNCH_GAP_SECONDS = 60;
    const sorted = [...rawPunches].sort((a, b) =>
      a.employeeCode.localeCompare(b.employeeCode) ||
      a.timestamp.getTime() - b.timestamp.getTime()
    );
    const lastPunchPerEmployee = new Map<string, number>();
    const filtered = sorted.filter((raw) => {
      const lastTime = lastPunchPerEmployee.get(raw.employeeCode);
      const gap = lastTime !== undefined
        ? (raw.timestamp.getTime() - lastTime) / 1000
        : Infinity;
      if (gap < MIN_PUNCH_GAP_SECONDS) return false;
      lastPunchPerEmployee.set(raw.employeeCode, raw.timestamp.getTime());
      return true;
    });
    const doublePunchesFiltered = rawPunches.length - filtered.length;

    // Insert punches, skipping duplicates
    let imported = 0;
    let skipped = doublePunchesFiltered;

    for (const raw of filtered) {
      const employeeId = codeToId.get(raw.employeeCode)!;

      try {
        await prisma.punch.create({
          data: {
            employeeId,
            timestamp: raw.timestamp,
            type: "UNKNOWN",
            isManual: false,
            source: "IMPORT",
            rawLine: raw.rawLine,
          },
        });
        imported++;
      } catch (error: unknown) {
        const prismaError = error as { code?: string };
        if (prismaError.code === "P2002") {
          // Duplicate — same employeeId + timestamp
          skipped++;
        } else {
          throw error;
        }
      }
    }

    // Count manual punches that are preserved (not touched by import)
    const manualPunchCount = await prisma.punch.count({
      where: {
        employeeId: { in: [...codeToId.values()] },
        isManual: true,
      },
    });

    return NextResponse.json({
      total: rawPunches.length,
      imported,
      skipped,
      newEmployees,
      manualPunchesPreserved: manualPunchCount,
    });
  } catch (error) {
    console.error("POST /api/import error:", error);
    return NextResponse.json(
      { error: "Failed to import file" },
      { status: 500 }
    );
  }
}
