import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authHelpers";
import { getTokens, getClientCredentials, searchInvoices, getOpenInvoices, findOrCreateCustomer, createInvoice } from "@/lib/quickbooks";

// GET /api/quickbooks/invoices?search=term
// Without search param: returns all open (unpaid/partially paid) invoices
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
    const search = searchParams.get("search")?.trim();

    // If search provided, filter by search term
    if (search) {
      const invoices = await searchInvoices(search);
      return NextResponse.json({ invoices, connected: true, configured });
    }

    // No search — return all open invoices
    const invoices = await getOpenInvoices();
    return NextResponse.json({ invoices, connected: true, configured });
  } catch (err) {
    console.error("QBO invoice error:", err);
    return NextResponse.json({ invoices: [], connected: false, configured: true, error: "Failed to fetch invoices" });
  }
}

// POST /api/quickbooks/invoices — Create a new invoice
export async function POST(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const tokens = await getTokens();
    if (!tokens) {
      return NextResponse.json({ error: "QuickBooks not connected" }, { status: 400 });
    }

    const body = await request.json();
    const { customerName, lines, taxAmount, taxRate, salesPerson, customerPhone, customerAddress, customerCity, customerState, customerZip } = body as {
      customerName: string;
      lines: { itemId: string; amount: number; description?: string }[];
      taxAmount?: number;
      taxRate?: number;
      salesPerson?: string;
      customerPhone?: string;
      customerAddress?: string;
      customerCity?: string;
      customerState?: string;
      customerZip?: string;
    };

    if (!customerName || !lines?.length) {
      return NextResponse.json({ error: "customerName and lines are required" }, { status: 400 });
    }

    const customerDetails = (customerPhone || customerAddress || customerCity || customerState || customerZip)
      ? { phone: customerPhone, address: customerAddress, city: customerCity, state: customerState, zip: customerZip }
      : undefined;
    const customer = await findOrCreateCustomer(customerName, customerDetails);
    const tax = taxAmount && taxRate ? { taxAmount, taxRate } : undefined;
    const invoice = await createInvoice(customer.id, lines, tax, salesPerson);

    return NextResponse.json({
      invoice: {
        id: invoice.invoiceId,
        docNumber: invoice.docNumber,
        customerId: customer.id,
        customerName: customer.displayName,
        totalAmt: invoice.totalAmt,
      },
    });
  } catch (err) {
    console.error("QBO create invoice error:", err);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}
