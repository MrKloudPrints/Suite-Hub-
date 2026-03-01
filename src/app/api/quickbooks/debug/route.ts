import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authHelpers";
import { qboFetch } from "@/lib/quickbooks";

// GET /api/quickbooks/debug — Show custom field configuration
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    // Get full preferences
    const prefs = await qboFetch("/preferences");
    const salesPrefs = prefs?.Preferences?.SalesFormsPrefs || {};

    // Extract SalesCustomName1/2/3 specifically
    const customNameFields: Record<string, string> = {};
    for (const idx of ["1", "2", "3"]) {
      customNameFields[`SalesCustomName${idx}`] = salesPrefs[`SalesCustomName${idx}`] || "(empty)";
    }

    // Get a few sample invoices to see their CustomField arrays
    const probe = await qboFetch(`/query?query=${encodeURIComponent("SELECT * FROM Invoice MAXRESULTS 3")}`);
    const invoices = probe?.QueryResponse?.Invoice || [];
    const sampleInvoices = invoices.map((inv: Record<string, unknown>) => ({
      id: inv.Id,
      docNumber: inv.DocNumber,
      customFields: inv.CustomField || [],
    }));

    return NextResponse.json({
      customNameFields,
      salesFormsPrefsKeys: Object.keys(salesPrefs),
      salesFormsPrefs: salesPrefs,
      sampleInvoices,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
