import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authHelpers";
import { getTokens, getPaymentMethods } from "@/lib/quickbooks";

// GET /api/quickbooks/payment-methods
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const tokens = await getTokens();
    if (!tokens) {
      return NextResponse.json({ methods: [] });
    }

    const methods = await getPaymentMethods();
    return NextResponse.json({ methods });
  } catch (err) {
    console.error("QBO payment methods error:", err);
    return NextResponse.json({ methods: [] });
  }
}
