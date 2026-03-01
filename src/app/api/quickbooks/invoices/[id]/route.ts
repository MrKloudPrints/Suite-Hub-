import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authHelpers";
import { getTokens, getInvoiceDetail, updateInvoiceTracking } from "@/lib/quickbooks";

// GET /api/quickbooks/invoices/[id] — Get full invoice detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const tokens = await getTokens();
    if (!tokens) {
      return NextResponse.json({ error: "QuickBooks not connected" }, { status: 400 });
    }

    const { id } = await params;
    const invoice = await getInvoiceDetail(id);
    return NextResponse.json({ invoice });
  } catch (err) {
    console.error("QBO invoice detail error:", err);
    return NextResponse.json({ error: "Failed to fetch invoice detail" }, { status: 500 });
  }
}

// PATCH /api/quickbooks/invoices/[id] — Update tracking number
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const tokens = await getTokens();
    if (!tokens) {
      return NextResponse.json({ error: "QuickBooks not connected" }, { status: 400 });
    }

    const { id } = await params;
    const body = await request.json();
    const { trackingNumber } = body as { trackingNumber: string };

    if (!trackingNumber) {
      return NextResponse.json({ error: "trackingNumber is required" }, { status: 400 });
    }

    const result = await updateInvoiceTracking(id, trackingNumber);
    return NextResponse.json(result);
  } catch (err) {
    console.error("QBO update tracking error:", err);
    return NextResponse.json({ error: "Failed to update tracking number" }, { status: 500 });
  }
}
