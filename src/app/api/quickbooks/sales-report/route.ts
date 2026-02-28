import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authHelpers";
import { getSalesReport } from "@/lib/quickbooks";

// GET /api/quickbooks/sales-report?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
    }

    const invoices = await getSalesReport(startDate, endDate);

    // ── Overall totals ──
    const totals = {
      total: 0,
      paid: 0,
      unpaid: 0,
      totalTax: 0,
      byMethod: {} as Record<string, number>,
    };

    // ── By Salesperson ──
    const bySalesperson: Record<string, { sales: number; count: number }> = {};

    // ── By Customer ──
    const byCustomer: Record<string, { sales: number; count: number; customerId: string }> = {};

    // ── By Date ──
    const byDate: Record<string, { sales: number; count: number; tax: number }> = {};

    // ── By Day of Week ──
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const byDayOfWeek: Record<string, { sales: number; count: number }> = {};
    for (const d of dayNames) byDayOfWeek[d] = { sales: 0, count: 0 };

    // ── By Product ──
    const byProduct: Record<string, { qty: number; revenue: number; count: number; itemId: string }> = {};

    for (const inv of invoices) {
      totals.total += inv.totalAmt;
      const paidAmt = inv.totalAmt - inv.balance;
      totals.paid += paidAmt;
      totals.unpaid += inv.balance;
      totals.totalTax += inv.taxAmount;

      // By payment method
      if (inv.status === "paid" || inv.status === "partial") {
        for (const pmt of inv.payments) {
          const method = pmt.method === "Unknown" ? "Other" : pmt.method;
          totals.byMethod[method] = (totals.byMethod[method] || 0) + pmt.amount;
        }
      }

      // By salesperson
      const rep = inv.salesRep || "Unassigned";
      if (!bySalesperson[rep]) bySalesperson[rep] = { sales: 0, count: 0 };
      bySalesperson[rep].sales += inv.totalAmt;
      bySalesperson[rep].count += 1;

      // By customer
      const custName = inv.customerName || "Unknown";
      if (!byCustomer[custName]) byCustomer[custName] = { sales: 0, count: 0, customerId: inv.customerId };
      byCustomer[custName].sales += inv.totalAmt;
      byCustomer[custName].count += 1;

      // By date & day of week
      if (inv.txnDate) {
        const dateKey = inv.txnDate;
        if (!byDate[dateKey]) byDate[dateKey] = { sales: 0, count: 0, tax: 0 };
        byDate[dateKey].sales += inv.totalAmt;
        byDate[dateKey].count += 1;
        byDate[dateKey].tax += inv.taxAmount;

        const dayIdx = new Date(inv.txnDate + "T00:00:00").getDay();
        const dayName = dayNames[dayIdx];
        byDayOfWeek[dayName].sales += inv.totalAmt;
        byDayOfWeek[dayName].count += 1;
      }

      // By product
      for (const line of inv.lineItems) {
        const name = line.itemName;
        if (!byProduct[name]) byProduct[name] = { qty: 0, revenue: 0, count: 0, itemId: line.itemId };
        byProduct[name].qty += line.qty;
        byProduct[name].revenue += line.amount;
        byProduct[name].count += 1;
      }
    }

    return NextResponse.json({
      invoices,
      totals,
      bySalesperson,
      byCustomer,
      byDate,
      byDayOfWeek,
      byProduct,
    });
  } catch (err) {
    console.error("Sales report error:", err);
    return NextResponse.json({ error: "Failed to generate sales report" }, { status: 500 });
  }
}
