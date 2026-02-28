"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Wallet,
  Vault,
  ArrowDownCircle,
  ArrowUpCircle,
  Receipt,
  Plus,
  Banknote,
  ArrowRight,
  ArrowLeftRight,
  X,
  Scale,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CashSummaryData, CashReconciliationData } from "@/types";
import { cn } from "@/lib/utils";

type DatePreset = "this_week" | "last_week" | "this_month" | "last_month" | "custom";

interface LedgerRow {
  id: string;
  date: string;
  type: "CASH_IN" | "CASH_OUT" | "DEPOSIT" | "WITHDRAWAL" | "EXPENSE";
  description: string;
  category: string | null;
  source: string;
  registerChange: number;
  depositChange: number;
  registerBalance: number;
  depositBalance: number;
}

interface LedgerData {
  startingRegister: number;
  startingDeposit: number;
  ledger: LedgerRow[];
}

function getDateRange(preset: DatePreset): { start: string; end: string } | null {
  if (preset === "custom") return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const day = now.getDay();

  const fmt = (dt: Date) => {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  };

  if (preset === "this_week") {
    const mon = d - (day === 0 ? 6 : day - 1);
    const start = new Date(y, m, mon);
    const end = new Date(y, m, mon + 6);
    return { start: fmt(start), end: fmt(end) };
  }
  if (preset === "last_week") {
    const mon = d - (day === 0 ? 6 : day - 1) - 7;
    const start = new Date(y, m, mon);
    const end = new Date(y, m, mon + 6);
    return { start: fmt(start), end: fmt(end) };
  }
  if (preset === "this_month") {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return { start: fmt(start), end: fmt(end) };
  }
  if (preset === "last_month") {
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return { start: fmt(start), end: fmt(end) };
  }
  return null;
}

const typeLabels: Record<string, string> = {
  CASH_IN: "Cash In",
  CASH_OUT: "Cash Out",
  DEPOSIT: "To Deposit",
  WITHDRAWAL: "From Deposit",
  EXPENSE: "Expense",
};

const typeColors: Record<string, string> = {
  CASH_IN: "bg-green-100 text-green-700",
  CASH_OUT: "bg-red-100 text-red-700",
  DEPOSIT: "bg-blue-100 text-blue-700",
  WITHDRAWAL: "bg-amber-100 text-amber-700",
  EXPENSE: "bg-orange-100 text-orange-700",
};

export default function CashDashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === "ADMIN";

  const [summary, setSummary] = useState<CashSummaryData | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);
  const [lastRecon, setLastRecon] = useState<CashReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);

  // Transfer state
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDirection, setTransferDirection] = useState<"to-deposit" | "to-register">("to-deposit");
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState("");

  const handleTransfer = async () => {
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) return;
    setTransferSaving(true);
    try {
      const type = transferDirection === "to-deposit" ? "DEPOSIT" : "WITHDRAWAL";
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const res = await fetch("/api/cash/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type, amount: amt, registerAmount: amt, depositAmount: amt,
          changeGiven: 0, category: "Transfer", source: "REGISTER", date: dateStr,
        }),
      });
      if (!res.ok) throw new Error();
      const label = transferDirection === "to-deposit" ? "Register → Deposit" : "Deposit → Register";
      setTransferSuccess(`${formatCurrency(amt)} transferred (${label})`);
      setTransferAmount("");
      setTimeout(() => setTransferSuccess(""), 4000);
      fetchData();
    } catch { /* ignore */ }
    setTransferSaving(false);
  };

  // Date filter state
  const [datePreset, setDatePreset] = useState<DatePreset>("this_week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const fetchData = useCallback(async () => {
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

      const [summaryRes, ledgerRes, reconRes] = await Promise.all([
        fetch("/api/cash/summary"),
        isAdmin ? fetch(`/api/cash/ledger?${params}`) : Promise.resolve(null),
        isAdmin ? fetch("/api/cash/reconciliation") : Promise.resolve(null),
      ]);
      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (ledgerRes?.ok) setLedgerData(await ledgerRes.json());
      if (reconRes?.ok) {
        const recons = await reconRes.json();
        setLastRecon(recons.length > 0 ? recons[0] : null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [isAdmin, datePreset, customStart, customEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Employee view — simple quick actions only
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {session?.user?.name}
          </h1>
          <p className="text-slate-500 mt-1">
            Record cash entries and expenses below
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => router.push("/cash/entries")}
            className="flex items-center gap-4 p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-emerald-300 hover:shadow-md transition text-left"
          >
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Plus className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Log Cash Entry</h3>
              <p className="text-sm text-slate-500">Record cash in or give change</p>
            </div>
          </button>
          <button
            onClick={() => router.push("/cash/expenses")}
            className="flex items-center gap-4 p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-orange-300 hover:shadow-md transition text-left"
          >
            <div className="p-3 bg-orange-100 rounded-xl">
              <Receipt className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Log Expense</h3>
              <p className="text-sm text-slate-500">Record expenses with receipts</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cash Dashboard</h1>
        <p className="text-slate-500 mt-1">Live balances and running totals</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wallet className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm text-slate-500">Register</span>
            </div>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(summary.registerBalance)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Vault className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm text-slate-500">Deposit</span>
            </div>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(summary.depositBalance)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <ArrowDownCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm text-slate-500">Today In</span>
            </div>
            <p className="text-xl font-bold text-green-600">{formatCurrency(summary.todayCashIn)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <ArrowUpCircle className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-sm text-slate-500">Today Out</span>
            </div>
            <p className="text-xl font-bold text-red-600">{formatCurrency(summary.todayCashOut)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Receipt className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-sm text-slate-500">Today Exp</span>
            </div>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(summary.todayExpenses)}</p>
          </div>
        </div>
      )}

      {/* Quick Transfer */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Quick Transfer</h3>
            <p className="text-xs text-slate-500">Move cash between register and deposit</p>
          </div>
        </div>
        {transferSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {transferSuccess}
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setTransferDirection("to-deposit")}
              className={cn(
                "px-3 py-2 text-xs font-medium transition",
                transferDirection === "to-deposit"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              Register → Deposit
            </button>
            <button
              onClick={() => setTransferDirection("to-register")}
              className={cn(
                "px-3 py-2 text-xs font-medium transition border-l border-slate-200",
                transferDirection === "to-register"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              Deposit → Register
            </button>
          </div>
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
          />
          <button
            onClick={handleTransfer}
            disabled={transferSaving || !transferAmount || parseFloat(transferAmount) <= 0}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {transferSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Transfer"}
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => router.push("/cash/entries")}
          className="flex items-center gap-4 p-5 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-emerald-300 hover:shadow-md transition text-left"
        >
          <div className="p-3 bg-emerald-100 rounded-xl">
            <Plus className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Log Cash Entry</h3>
            <p className="text-sm text-slate-500">Record cash in, out, or deposits</p>
          </div>
        </button>
        <button
          onClick={() => router.push("/cash/expenses")}
          className="flex items-center gap-4 p-5 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-orange-300 hover:shadow-md transition text-left"
        >
          <div className="p-3 bg-orange-100 rounded-xl">
            <Receipt className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Log Expense</h3>
            <p className="text-sm text-slate-500">Record expenses with receipts</p>
          </div>
        </button>
        <button
          onClick={() => router.push("/cash/reports")}
          className="flex items-center gap-4 p-5 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-md transition text-left"
        >
          <div className="p-3 bg-blue-100 rounded-xl">
            <Banknote className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">View Reports</h3>
            <p className="text-sm text-slate-500">Cash flow charts and summaries</p>
          </div>
        </button>
      </div>

      {/* Last Reconciliation */}
      {lastRecon && (
        <button
          onClick={() => router.push("/cash/reconciliation")}
          className="w-full text-left bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", lastRecon.discrepancy === 0 ? "bg-green-100" : "bg-amber-100")}>
                {lastRecon.discrepancy === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Last Reconciliation</h3>
                <p className="text-sm text-slate-500">
                  {new Date(lastRecon.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {" — "}
                  Register: {formatCurrency(lastRecon.registerActual)} / Deposit: {formatCurrency(lastRecon.depositActual)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn("text-lg font-bold", lastRecon.discrepancy === 0 ? "text-green-600" : "text-red-600")}>
                {lastRecon.discrepancy === 0 ? "Balanced" : `${lastRecon.discrepancy > 0 ? "+" : ""}${formatCurrency(lastRecon.discrepancy)}`}
              </p>
              <p className="text-xs text-slate-400">Discrepancy</p>
            </div>
          </div>
        </button>
      )}

      {/* Running Total Ledger */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">Running Total</h3>
            {summary && (
              <div className="text-sm text-slate-500">
                Starting: {formatCurrency(summary.weeklyStartingBalance)}
              </div>
            )}
          </div>
          {/* Date Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-1.5">
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
            </div>
            {datePreset === "custom" && (
              <div className="flex items-end gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">From</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">To</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {!ledgerData || ledgerData.ledger.length === 0 ? (
            <p className="text-slate-500 text-center py-12 text-sm">No transactions in this period.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-2.5">Date</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-2.5">Type</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-2.5">Description</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-5 py-2.5">Register +/-</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-5 py-2.5">Deposit +/-</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-5 py-2.5">Register Bal</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-5 py-2.5">Deposit Bal</th>
                </tr>
              </thead>
              <tbody>
                {ledgerData.ledger.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-2.5 text-sm text-slate-700">
                      {new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", typeColors[row.type])}>
                        {typeLabels[row.type]}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-sm text-slate-600 max-w-xs truncate">
                      {row.description}
                      {row.category && (
                        <span className="ml-1.5 text-xs text-slate-400">({row.category})</span>
                      )}
                    </td>
                    <td className={cn("px-5 py-2.5 text-sm text-right font-medium", row.registerChange > 0 ? "text-green-600" : row.registerChange < 0 ? "text-red-600" : "text-slate-300")}>
                      {row.registerChange !== 0 ? (row.registerChange > 0 ? "+" : "") + formatCurrency(row.registerChange) : "—"}
                    </td>
                    <td className={cn("px-5 py-2.5 text-sm text-right font-medium", row.depositChange > 0 ? "text-green-600" : row.depositChange < 0 ? "text-red-600" : "text-slate-300")}>
                      {row.depositChange !== 0 ? (row.depositChange > 0 ? "+" : "") + formatCurrency(row.depositChange) : "—"}
                    </td>
                    <td className="px-5 py-2.5 text-sm text-right font-bold text-slate-900">
                      {formatCurrency(row.registerBalance)}
                    </td>
                    <td className="px-5 py-2.5 text-sm text-right font-bold text-slate-900">
                      {formatCurrency(row.depositBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-slate-700">
                    {ledgerData.ledger.length} transaction{ledgerData.ledger.length !== 1 ? "s" : ""}
                  </td>
                  <td colSpan={2} />
                  <td className="px-5 py-3 text-sm font-bold text-blue-600 text-right">
                    {formatCurrency(ledgerData.ledger[ledgerData.ledger.length - 1]?.registerBalance ?? 0)}
                  </td>
                  <td className="px-5 py-3 text-sm font-bold text-purple-600 text-right">
                    {formatCurrency(ledgerData.ledger[ledgerData.ledger.length - 1]?.depositBalance ?? 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Weekly Status */}
      {summary && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-3">Weekly Status</h3>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-sm text-slate-500">Starting Balance</p>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(summary.weeklyStartingBalance)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Current Register</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(summary.registerBalance)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Current Deposit</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(summary.depositBalance)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
