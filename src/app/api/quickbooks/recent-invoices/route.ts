import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authHelpers";
import { getTokens, getClientCredentials, getRecentInvoices } from "@/lib/quickbooks";

// GET /api/quickbooks/recent-invoices?search=&status=all&dateRange=today
export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { clientId } = await getClientCredentials();
    const tokens = await getTokens();
    const configured = !!clientId;
    const connected = !!tokens;

    if (!connected) {
      return NextResponse.json({ invoices: [], connected: false, configured });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || undefined;
    const status = (searchParams.get("status") as "all" | "paid" | "unpaid") || "all";
    const dateRange = (searchParams.get("dateRange") as "today" | "week" | "month" | "all") || "today";

    const invoices = await getRecentInvoices({ search, status, dateRange });
    return NextResponse.json({ invoices, connected: true, configured });
  } catch (err) {
    console.error("QBO recent invoices error:", err);
    return NextResponse.json({ invoices: [], connected: false, configured: true, error: "Failed to fetch invoices" });
  }
}
