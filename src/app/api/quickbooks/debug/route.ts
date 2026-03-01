import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authHelpers";
import { qboFetch } from "@/lib/quickbooks";

// GET /api/quickbooks/debug — Show custom field configuration
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    // Get preferences
    const prefs = await qboFetch("/preferences");
    const salesPrefs = prefs?.Preferences?.SalesFormsPrefs || {};

    // Get a sample invoice to see its CustomField array
    const probe = await qboFetch(`/query?query=${encodeURIComponent("SELECT * FROM Invoice MAXRESULTS 1")}`);
    const sampleInv = (probe?.QueryResponse?.Invoice || [])[0];

    return NextResponse.json({
      salesFormsPrefs: salesPrefs,
      sampleInvoiceCustomFields: sampleInv?.CustomField || [],
      sampleInvoiceId: sampleInv?.Id || null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
