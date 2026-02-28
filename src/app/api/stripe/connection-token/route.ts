import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authHelpers";
import { createConnectionToken } from "@/lib/stripe";

export async function POST() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { secret } = await createConnectionToken();
    return NextResponse.json({ secret });
  } catch (err) {
    console.error("Stripe connection token error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create connection token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
