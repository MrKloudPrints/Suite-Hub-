import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authHelpers";
import { createPaymentIntent, getPublishableKey } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { amount, invoiceNumber, customerName } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    const { clientSecret, paymentIntentId } = await createPaymentIntent(
      amount,
      invoiceNumber || "",
      customerName || ""
    );

    const publishableKey = await getPublishableKey();

    return NextResponse.json({ clientSecret, paymentIntentId, publishableKey });
  } catch (err) {
    console.error("Stripe PaymentIntent error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create payment intent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
