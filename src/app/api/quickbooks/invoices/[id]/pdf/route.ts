import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authHelpers";
import { qboFetchRaw } from "@/lib/quickbooks";

// GET /api/quickbooks/invoices/{id}/pdf
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    const res = await qboFetchRaw(`/invoice/${id}/pdf`, {
      headers: { Accept: "application/pdf" },
    });

    const pdfBuffer = await res.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${id}.pdf"`,
      },
    });
  } catch (err) {
    console.error("QBO invoice PDF error:", err);
    return NextResponse.json(
      { error: "Failed to fetch invoice PDF" },
      { status: 500 }
    );
  }
}
