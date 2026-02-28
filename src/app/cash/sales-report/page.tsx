"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  Loader2,
  FileText,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  ChevronDown,
  Users,
  UserCheck,
  Calendar,
  Package,
  Receipt,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ── Types ──

interface PaymentDetail { id: string; amount: number; method: string; date: string }
interface LineItem { itemName: string; itemId: string; qty: number; unitPrice: number; amount: number }

interface SalesInvoice {
  id: string; docNumber: string; customerName: string; customerId: string;
  totalAmt: number; balance: number; dueDate: string; txnDate: string;
  status: "paid" | "partial" | "unpaid"; paymentMethod: string; paymentDate: string;
  payments: PaymentDetail[]; salesRep: string; lineItems: LineItem[]; taxAmount: number;
}

interface BreakdownEntry { sales: number; count: number; customerId?: string; tax?: number }
interface ProductEntry { qty: number; revenue: number; count: number; itemId: string }

interface SalesReportData {
  invoices: SalesInvoice[];
  totals: { total: number; paid: number; unpaid: number; totalTax: number; byMethod: Record<string, number> };
  bySalesperson: Record<string, BreakdownEntry>;
  byCustomer: Record<string, BreakdownEntry & { customerId: string }>;
  byDate: Record<string, BreakdownEntry & { tax: number }>;
  byDayOfWeek: Record<string, BreakdownEntry>;
  byProduct: Record<string, ProductEntry>;
}

type DatePreset = "this_week" | "last_week" | "this_month" | "last_month" | "custom";
type ReportTab = "invoices" | "salesperson" | "customer" | "date" | "product";

function getDateRange(preset: DatePreset): { start: string; end: string } | null {
  if (preset === "custom") return null;
  const now = new Date();
  const y = now.getFullYear(); const m = now.getMonth(); const d = now.getDate(); const day = now.getDay();
  const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  if (preset === "this_week") { const mon = d - (day === 0 ? 6 : day - 1); return { start: fmt(new Date(y, m, mon)), end: fmt(new Date(y, m, mon + 6)) }; }
  if (preset === "last_week") { const mon = d - (day === 0 ? 6 : day - 1) - 7; return { start: fmt(new Date(y, m, mon)), end: fmt(new Date(y, m, mon + 6)) }; }
  if (preset === "this_month") { return { start: fmt(new Date(y, m, 1)), end: fmt(new Date(y, m + 1, 0)) }; }
  if (preset === "last_month") { return { start: fmt(new Date(y, m - 1, 1)), end: fmt(new Date(y, m, 0)) }; }
  return null;
}

const statusBadge = { paid: "bg-emerald-50 text-emerald-700", partial: "bg-amber-50 text-amber-700", unpaid: "bg-red-50 text-red-700" };
const methodBadge: Record<string, string> = { Cash: "bg-emerald-50 text-emerald-700", Zelle: "bg-violet-50 text-violet-700", Stripe: "bg-blue-50 text-blue-700", Unpaid: "bg-slate-100 text-slate-500", Multiple: "bg-amber-50 text-amber-700" };

function fmtDate(d: string) {
  return d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

// ── Reusable breakdown table ──
function BreakdownTable({ data, columns }: {
  data: { label: string; values: (string | number)[] }[];
  columns: string[];
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((c, i) => (
                <th key={c} className={cn("px-4 py-3 font-medium text-slate-600", i === 0 ? "text-left" : "text-right")}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-8 text-slate-500">No data for this period.</td></tr>
            ) : (
              data.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  {row.values.map((v, j) => (
                    <td key={j} className={cn("px-4 py-3", j === 0 ? "text-left font-medium text-slate-900" : "text-right text-slate-700")}>
                      {typeof v === "number" ? formatCurrency(v) : v}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ──

export default function SalesReportPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [report, setReport] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportTab>("invoices");

  const [datePreset, setDatePreset] = useState<DatePreset>("this_week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [salesRepFilter, setSalesRepFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (datePreset === "custom") {
        if (customStart) params.set("startDate", customStart);
        if (customEnd) params.set("endDate", customEnd);
      } else {
        const range = getDateRange(datePreset);
        if (range) { params.set("startDate", range.start); params.set("endDate", range.end); }
      }
      const res = await fetch(`/api/quickbooks/sales-report?${params}`);
      if (res.ok) setReport(await res.json());
    } catch { /* */ } finally { setLoading(false); }
  }, [datePreset, customStart, customEnd]);

  useEffect(() => { fetchReport(); }, [fetchReport]);
  useEffect(() => { setMethodFilter("all"); setCustomerFilter("all"); setSalesRepFilter("all"); }, [report]);

  const uniqueMethods = useMemo(() => {
    const set = new Set<string>();
    for (const inv of report?.invoices || []) set.add(inv.paymentMethod);
    return Array.from(set).sort();
  }, [report]);

  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, string>();
    for (const inv of report?.invoices || []) if (inv.customerName) map.set(inv.customerId, inv.customerName);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [report]);

  const uniqueSalesReps = useMemo(() => {
    const set = new Set<string>();
    for (const inv of report?.invoices || []) if (inv.salesRep) set.add(inv.salesRep);
    return Array.from(set).sort();
  }, [report]);

  const presetLabel = {
    this_week: "This Week", last_week: "Last Week", this_month: "This Month",
    last_month: "Last Month", custom: customStart && customEnd ? `${customStart} — ${customEnd}` : "Custom Range",
  }[datePreset];

  const filtered = (report?.invoices || []).filter((inv) => {
    if (statusFilter === "paid" && inv.status !== "paid") return false;
    if (statusFilter === "unpaid" && inv.status === "paid") return false;
    if (methodFilter !== "all" && inv.paymentMethod !== methodFilter) return false;
    if (customerFilter !== "all" && inv.customerId !== customerFilter) return false;
    if (salesRepFilter !== "all" && inv.salesRep !== salesRepFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!inv.customerName.toLowerCase().includes(q) && !inv.docNumber.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filteredTotals = useMemo(() => {
    const t = { total: 0, paid: 0, unpaid: 0, totalTax: 0, byMethod: {} as Record<string, number> };
    for (const inv of filtered) {
      t.total += inv.totalAmt;
      t.paid += inv.totalAmt - inv.balance;
      t.unpaid += inv.balance;
      t.totalTax += inv.taxAmount;
      if (inv.status === "paid" || inv.status === "partial") {
        for (const pmt of inv.payments) {
          const method = pmt.method === "Unknown" ? "Other" : pmt.method;
          t.byMethod[method] = (t.byMethod[method] || 0) + pmt.amount;
        }
      }
    }
    return t;
  }, [filtered]);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  if (!report) return <p className="text-slate-500 text-center py-12">Failed to load sales report.</p>;

  const hasActiveFilters = methodFilter !== "all" || customerFilter !== "all" || salesRepFilter !== "all" || statusFilter !== "all" || search;

  const tabs: { id: ReportTab; label: string; icon: typeof FileText }[] = [
    { id: "invoices", label: "Invoices", icon: FileText },
    { id: "salesperson", label: "By Sales Person", icon: UserCheck },
    { id: "customer", label: "By Customer", icon: Users },
    { id: "date", label: "By Date", icon: Calendar },
    { id: "product", label: "By Product", icon: Package },
  ];

  // ── Prepare breakdown data ──
  const salespersonRows = Object.entries(report.bySalesperson)
    .sort((a, b) => b[1].sales - a[1].sales)
    .map(([name, d]) => ({ label: name, values: [name, String(d.count), d.sales, d.count > 0 ? d.sales / d.count : 0] }));

  const customerRows = Object.entries(report.byCustomer)
    .sort((a, b) => b[1].sales - a[1].sales)
    .map(([name, d]) => ({ label: name, values: [name, String(d.count), d.sales, d.count > 0 ? d.sales / d.count : 0] }));

  const dateRows = Object.entries(report.byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, d]) => {
      const dayName = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
      return { label: date, values: [fmtDate(date), dayName, String(d.count), d.sales, d.tax] };
    });

  const dayOfWeekRows = Object.entries(report.byDayOfWeek)
    .filter(([, d]) => d.count > 0)
    .sort((a, b) => b[1].sales - a[1].sales)
    .map(([day, d]) => ({ label: day, values: [day, String(d.count), d.sales, d.count > 0 ? d.sales / d.count : 0] }));

  const productRows = Object.entries(report.byProduct)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([name, d]) => ({ label: name, values: [name, String(d.qty), String(d.count), d.revenue] }));

  return (
    <div className="space-y-6">
      {/* Header + Date Presets */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><FileText className="w-5 h-5 text-blue-600" /></div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Sales Report</h2>
              <p className="text-xs text-slate-500">{presetLabel}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {([ ["this_week", "This Week"], ["last_week", "Last Week"], ["this_month", "This Month"], ["last_month", "Last Month"], ["custom", "Custom"] ] as [DatePreset, string][]).map(([value, label]) => (
            <button key={value} onClick={() => setDatePreset(value)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition", datePreset === value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50")}>
              {label}
            </button>
          ))}
          {datePreset === "custom" && (
            <>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-xs text-slate-400">to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" />
            </>
          )}
        </div>
      </div>

      {/* Summary Cards — admin only */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-blue-500" /><span className="text-xs text-slate-500">Total Sales</span></div>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(filteredTotals.total)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-xs text-slate-500">Paid</span></div>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(filteredTotals.paid)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1"><AlertCircle className="w-4 h-4 text-red-500" /><span className="text-xs text-slate-500">Unpaid</span></div>
            <p className="text-lg font-bold text-red-600">{formatCurrency(filteredTotals.unpaid)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1"><Receipt className="w-4 h-4 text-orange-500" /><span className="text-xs text-slate-500">Tax Collected</span></div>
            <p className="text-lg font-bold text-orange-600">{formatCurrency(filteredTotals.totalTax)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-violet-500" /><span className="text-xs text-slate-500">By Method</span></div>
            <div className="space-y-0.5">
              {Object.entries(filteredTotals.byMethod).length > 0
                ? Object.entries(filteredTotals.byMethod).map(([method, amt]) => (
                    <div key={method} className="flex justify-between text-xs"><span className="text-slate-600">{method}</span><span className="font-medium text-slate-900">{formatCurrency(amt)}</span></div>
                  ))
                : <p className="text-xs text-slate-400">No payments</p>}
            </div>
          </div>
        </div>
      )}

      {/* Report Tabs — admin only */}
      {isAdmin && (
        <div className="flex flex-wrap gap-1 bg-white rounded-xl shadow-sm border border-slate-200 p-1.5">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn("flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition",
                activeTab === tab.id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ════════ TAB: Invoices (always shown for employees, tab-based for admins) ════════ */}
      {(activeTab === "invoices" || !isAdmin) && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "paid", "unpaid"] as const).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition capitalize",
                    statusFilter === s ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50")}>
                  {s}
                </button>
              ))}
              <div className="w-px h-6 bg-slate-200 mx-1" />
              <div className="relative">
                <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}
                  className={cn("appearance-none pl-3 pr-7 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer",
                    methodFilter !== "all" ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50")}>
                  <option value="all">All Methods</option>
                  {uniqueMethods.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative">
                <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}
                  className={cn("appearance-none pl-3 pr-7 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer max-w-[180px]",
                    customerFilter !== "all" ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50")}>
                  <option value="all">All Customers</option>
                  {uniqueCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative">
                <select value={salesRepFilter} onChange={(e) => setSalesRepFilter(e.target.value)}
                  className={cn("appearance-none pl-3 pr-7 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer max-w-[180px]",
                    salesRepFilter !== "all" ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50")}>
                  <option value="all">All Sales People</option>
                  {uniqueSalesReps.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative ml-auto">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Search customer or invoice #" value={search} onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 w-64" />
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-2 pt-1">
                <button onClick={() => { setStatusFilter("all"); setMethodFilter("all"); setCustomerFilter("all"); setSalesRepFilter("all"); setSearch(""); }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium">Clear all filters</button>
                <span className="text-xs text-slate-400">Showing {filtered.length} of {report.invoices.length} invoices</span>
              </div>
            )}
          </div>

          {/* Invoice table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Invoice #</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Sales Person</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Tax</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Balance</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Method</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-slate-500">No invoices found for this period.</td></tr>
                  ) : filtered.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{inv.docNumber || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{inv.customerName}</td>
                      <td className="px-4 py-3 text-slate-600">{inv.salesRep || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(inv.txnDate)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(inv.totalAmt)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{inv.taxAmount > 0 ? formatCurrency(inv.taxAmount) : "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(inv.balance)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", statusBadge[inv.status])}>{inv.status}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("inline-block px-2.5 py-0.5 rounded-full text-xs font-medium", methodBadge[inv.paymentMethod] || "bg-slate-100 text-slate-600")}>{inv.paymentMethod}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => window.open(`/api/quickbooks/invoices/${inv.id}/pdf`, "_blank")}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                          <ExternalLink className="w-3.5 h-3.5" />View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ════════ TAB: By Sales Person (admin only) ════════ */}
      {isAdmin && activeTab === "salesperson" && (
        <BreakdownTable
          columns={["Sales Person", "Invoices", "Total Sales", "Avg Sale"]}
          data={salespersonRows}
        />
      )}

      {/* ════════ TAB: By Customer (admin only) ════════ */}
      {isAdmin && activeTab === "customer" && (
        <BreakdownTable
          columns={["Customer", "Invoices", "Total Sales", "Avg Sale"]}
          data={customerRows}
        />
      )}

      {/* ════════ TAB: By Date (admin only) ════════ */}
      {isAdmin && activeTab === "date" && (
        <div className="space-y-6">
          <BreakdownTable
            columns={["Date", "Day", "Invoices", "Sales", "Tax"]}
            data={dateRows}
          />
          {dayOfWeekRows.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Summary by Day of Week</h3>
              <BreakdownTable
                columns={["Day", "Invoices", "Total Sales", "Avg Sale"]}
                data={dayOfWeekRows}
              />
            </div>
          )}
        </div>
      )}

      {/* ════════ TAB: By Product (admin only) ════════ */}
      {isAdmin && activeTab === "product" && (
        <BreakdownTable
          columns={["Product", "Qty Sold", "Times on Invoice", "Revenue"]}
          data={productRows}
        />
      )}
    </div>
  );
}
