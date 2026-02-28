import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authHelpers";
import { getTokens, getClientCredentials, getItems } from "@/lib/quickbooks";

// GET /api/quickbooks/items — Returns all active products/services
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { clientId } = await getClientCredentials();
    const tokens = await getTokens();
    const configured = !!clientId;
    const connected = !!tokens;

    if (!connected) {
      return NextResponse.json({ items: [], connected: false, configured });
    }

    const items = await getItems();
    return NextResponse.json({ items, connected: true, configured });
  } catch (err) {
    console.error("QBO items error:", err);
    return NextResponse.json({ items: [], connected: false, configured: true, error: "Failed to fetch items" });
  }
}
