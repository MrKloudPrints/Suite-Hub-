import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authHelpers";
import { createPayment } from "@/lib/quickbooks";

// POST /api/quickbooks/payment — Record a payment against a QBO invoice
export async function POST(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { invoiceId, customerId, amount, paymentMethodId } = await request.json();

    if (!invoiceId || !customerId || !amount) {
      return NextResponse.json(
        { error: "invoiceId, customerId, and amount are required" },
        { status: 400 }
      );
    }

    const result = await createPayment(invoiceId, customerId, amount, paymentMethodId);
    return NextResponse.json({ success: true, paymentId: result.paymentId });
  } catch (err) {
    console.error("QBO payment error:", err);
    return NextResponse.json(
      { error: "Failed to record payment in QuickBooks" },
      { status: 500 }
    );
  }
}
