import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/authHelpers";

// Keys that are safe for any authenticated user (non-sensitive config)
const PUBLIC_KEYS = new Set([
  "tax_rate",
  "sales_people",
  "qb_company_name",
  "stripe_publishable_key",
]);

// GET /api/settings — Return settings (filtered by role)
export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  try {
    const isAdmin = session!.user?.role === "ADMIN";
    const settings = await prisma.setting.findMany();

    const result: Record<string, string> = {};
    for (const setting of settings) {
      // Non-admins only see public keys
      if (!isAdmin && !PUBLIC_KEYS.has(setting.key)) continue;
      result[setting.key] = setting.value;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/settings error:", err);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// PATCH /api/settings — Update a setting (upsert) — admin only
export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "key and value are required" },
        { status: 400 }
      );
    }

    if (typeof key !== "string" || typeof value !== "string") {
      return NextResponse.json(
        { error: "key and value must be strings" },
        { status: 400 }
      );
    }

    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    return NextResponse.json(setting);
  } catch (err) {
    console.error("PATCH /api/settings error:", err);
    return NextResponse.json(
      { error: "Failed to update setting" },
      { status: 500 }
    );
  }
}
