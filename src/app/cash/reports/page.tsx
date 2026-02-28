"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ReportData {
  dailyData: { date: string; cashIn: number; cashOut: number; expenses: number }[];
  categoryBreakdown: Record<string, number>;
  totals: {
    cashIn: number;
    cashOut: number;
    expenses: number;
    deposits: number;
    netCashFlow: number;
  };
}

type DatePreset = "this_week" | "last_week" | "this_month" | "last_month" | "custom";

function getDateRange(preset: DatePreset): { start: string; end: string } | null {
  if (preset === "custom") return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const day = now.getDay();
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

  if (preset === "this_week") {
    const mon = d - (day === 0 ? 6 : day - 1);
    return { start: fmt(new Date(y, m, mon)), end: fmt(new Date(y, m, mon + 6)) };
  }
  if (preset === "last_week") {
    const mon = d - (day === 0 ? 6 : day - 1) - 7;
    return { start: fmt(new Date(y, m, mon)), end: fmt(new Date(y, m, mon + 6)) };
  }
  if (preset === "this_month") {
    return { start: fmt(new Date(y, m, 1)), end: fmt(new Date(y, m + 1, 0)) };
  }
  if (preset === "last_month") {
    return { start: fmt(new Date(y, m - 1, 1)), end: fmt(new Date(y, m, 0)) };
  }
  return null;
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // Redirect employees away from reports
  useEffect(() => {
    if (session && session.user?.role !== "ADMIN") {
      router.replace("/cash/entries");
    }
  }, [session, router]);

  const [datePreset, setDatePreset] = useState<DatePreset>("this_week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (datePreset === "custom") {
        if (customStart) params.set("startDate", customStart);
        if (customEnd) params.set("endDate", customEnd);
      } else {
        const range = getDateRange(datePreset);
        if (range) {
          params.set("startDate", range.start);
          params.set("endDate", range.end);
        }
      }
      const res = await fetch(`/api/cash/reports?${params}`);
      if (res.ok) setReport(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [datePreset, customStart, customEnd]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!report) {
    return <p className="text-slate-500 text-center py-12">Failed to load report data.</p>;
  }

  const chartData = report.dailyData.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  const presetLabel = {
    this_week: "This Week",
    last_week: "Last Week",
    this_month: "This Month",
    last_month: "Last Month",
    custom: customStart && customEnd ? `${customStart} — ${customEnd}` : "Custom Range",
  }[datePreset];

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Reports</h2>
              <p className="text-xs text-slate-500">{presetLabel}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {([
            ["this_week", "This Week"],
            ["last_week", "Last Week"],
            ["this_month", "This Month"],
            ["last_month", "Last Month"],
            ["custom", "Custom"],
          ] as [DatePreset, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setDatePreset(value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg border transition",
                datePreset === value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              )}
            >
              {label}
            </button>
          ))}
          {datePreset === "custom" && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs text-slate-500">Cash In</span>
          </div>
          <p className="text-lg font-bold text-green-600">{formatCurrency(report.totals.cashIn)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-slate-500">Cash Out</span>
          </div>
          <p className="text-lg font-bold text-red-600">{formatCurrency(report.totals.cashOut)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-slate-500">Expenses</span>
          </div>
          <p className="text-lg font-bold text-orange-600">{formatCurrency(report.totals.expenses)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-slate-500">Deposits</span>
          </div>
          <p className="text-lg font-bold text-blue-600">{formatCurrency(report.totals.deposits)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            {report.totals.netCashFlow >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className="text-xs text-slate-500">Net Flow</span>
          </div>
          <p className={`text-lg font-bold ${report.totals.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(report.totals.netCashFlow)}
          </p>
        </div>
      </div>

      {/* Cash Flow Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Daily Cash Flow</h3>
        {chartData.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No data for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
              <Legend />
              <Bar dataKey="cashIn" name="Cash In" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cashOut" name="Cash Out" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Expense Breakdown */}
      {Object.keys(report.categoryBreakdown).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Expense Breakdown by Category</h3>
          <div className="space-y-3">
            {Object.entries(report.categoryBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([category, amount]) => {
                const totalExp = report.totals.expenses || 1;
                const pct = Math.round((amount / totalExp) * 100);
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-700">{category}</span>
                      <span className="text-sm font-medium text-slate-900">
                        {formatCurrency(amount)} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
