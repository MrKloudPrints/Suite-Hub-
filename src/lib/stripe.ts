import Stripe from "stripe";
import { prisma } from "@/lib/db";

async function getStripeKeys() {
  const [skRow, pkRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "stripe_secret_key" } }),
    prisma.setting.findUnique({ where: { key: "stripe_publishable_key" } }),
  ]);
  return {
    secretKey: skRow?.value || "",
    publishableKey: pkRow?.value || "",
  };
}

function getStripeClient(secretKey: string) {
  if (!secretKey) throw new Error("Stripe secret key not configured");
  return new Stripe(secretKey);
}

export async function createPaymentIntent(
  amount: number,
  invoiceNumber: string,
  customerName: string
) {
  const { secretKey } = await getStripeKeys();
  const stripe = getStripeClient(secretKey);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Stripe expects cents
    currency: "usd",
    metadata: {
      invoice_number: invoiceNumber,
      customer_name: customerName,
    },
  });

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
}

export async function createConnectionToken() {
  const { secretKey } = await getStripeKeys();
  const stripe = getStripeClient(secretKey);

  const token = await stripe.terminal.connectionTokens.create();
  return { secret: token.secret };
}

export async function getPublishableKey() {
  const { publishableKey } = await getStripeKeys();
  return publishableKey;
}
