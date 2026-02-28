import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authHelpers";
import { getTokens, getClientCredentials, searchCustomers, getCustomers } from "@/lib/quickbooks";

// GET /api/quickbooks/customers?search=term
export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { clientId } = await getClientCredentials();
    const tokens = await getTokens();
    const configured = !!clientId;
    const connected = !!tokens;

    if (!connected) {
      return NextResponse.json({ customers: [], connected: false, configured });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();

    if (!search || search.length < 2) {
      const customers = await getCustomers();
      return NextResponse.json({ customers, connected: true, configured });
    }

    const customers = await searchCustomers(search);
    return NextResponse.json({ customers, connected: true, configured });
  } catch (err) {
    console.error("QBO customers error:", err);
    return NextResponse.json({ customers: [], connected: false, configured: true, error: "Failed to fetch customers" });
  }
}
