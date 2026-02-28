"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Scale,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  X,
  RotateCcw,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CashReconciliationData, CashSummaryData } from "@/types";
import { cn } from "@/lib/utils";

type DatePreset = "all" | "this_week" | "last_week" | "this_month" | "custom";

function getDateRange(preset: DatePreset): { start: string; end: string } | null {
  if (preset === "all" || preset === "custom") return null;
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
  return null;
}

export default function ReconciliationPage() {
  const [reconciliations, setReconciliations] = useState<CashReconciliationData[]>([]);
  const [summary, setSummary] = useState<CashSummaryData | null>(null);
  const [lastRecon, setLastRecon] = useState<{ date: string; registerActual: number; depositActual: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Date filter state
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Form state
  const [formRegisterActual, setFormRegisterActual] = useState("");
  const [formDepositActual, setFormDepositActual] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Register reset state
  const [resetAmount, setResetAmount] = useState("200");
  const [resetWeekStart, setResetWeekStart] = useState("");
  const [resetNotes, setResetNotes] = useState("");
  const [savingReset, setSavingReset] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Build recon query params for date filter
      const params = new URLSearchParams();
      if (datePreset === "custom") {
        if (customStart) params.set("startDate", customStart);
        if (customEnd) params.set("endDate", customEnd);
      } else if (datePreset !== "all") {
        const range = getDateRange(datePreset);
        if (range) {
          params.set("startDate", range.start);
          params.set("endDate", range.end);
        }
      }

      const [reconRes, summaryRes] = await Promise.all([
        fetch(`/api/cash/reconciliation?${params}`),
        fetch("/api/cash/summary"),
      ]);
      if (reconRes.ok) setReconciliations(await reconRes.json());
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
        setLastRecon(data.lastReconciliation || null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [datePreset, customStart, customEnd]);

  useEffect(() => {
    fetchData();
    // Set default week start to current Monday
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    setResetWeekStart(monday.toISOString().split("T")[0]);
  }, [fetchData]);

  const handleReconcile = async () => {
    setFormError("");
    if (!formRegisterActual || !formDepositActual) {
      setFormError("Enter both register and deposit actual amounts");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/cash/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registerActual: formRegisterActual,
          depositActual: formDepositActual,
          notes: formNotes,
          date: formDate,
        }),
      });
      if (!res.ok) throw new Error("Failed to create reconciliation");
      setShowModal(false);
      setFormRegisterActual("");
      setFormDepositActual("");
      setFormNotes("");
      fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this reconciliation?")) return;
    try {
      await fetch(`/api/cash/reconciliation/${id}`, { method: "DELETE" });
      fetchData();
    } catch {
      alert("Failed to delete");
    }
  };

  const handleSaveReset = async () => {
    setSavingReset(true);
    try {
      const res = await fetch("/api/cash/register-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: resetAmount, weekStart: resetWeekStart, notes: resetNotes }),
      });
      if (!res.ok) throw new Error("Failed");
      setShowResetModal(false);
      setResetNotes("");
      fetchData();
    } catch {
      alert("Failed to save reset");
    } finally {
      setSavingReset(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Status — Expected + Actual */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Register Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <p className="text-sm text-slate-500 mb-3 font-medium">Register</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Expected</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(summary.registerBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Last Counted</p>
                <p className="text-xl font-bold text-blue-600">
                  {lastRecon ? formatCurrency(lastRecon.registerActual) : "—"}
                </p>
                {lastRecon && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(lastRecon.date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Deposit Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <p className="text-sm text-slate-500 mb-3 font-medium">Deposit</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Expected</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(summary.depositBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Last Counted</p>
                <p className="text-xl font-bold text-purple-600">
                  {lastRecon ? formatCurrency(lastRecon.depositActual) : "—"}
                </p>
                {lastRecon && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(lastRecon.date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Starting Balance Info */}
      {summary && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 px-5 py-3 flex items-center justify-between">
          <div className="text-sm text-blue-700">
            Weekly Starting Balance: <span className="font-bold">{formatCurrency(summary.weeklyStartingBalance)}</span>
            {lastRecon && (
              <span className="ml-3 text-blue-500">
                (Baseline from last recon on {new Date(lastRecon.date).toLocaleDateString()})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          New Reconciliation
        </button>
        <button
          onClick={() => setShowResetModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition"
        >
          <RotateCcw className="w-4 h-4" />
          Set Register Starting Balance
        </button>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Scale className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="font-semibold text-slate-900">Reconciliation History</h2>
            </div>
          </div>
          {/* Date Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-1.5">
              {([
                ["all", "All"],
                ["this_week", "This Week"],
                ["last_week", "Last Week"],
                ["this_month", "This Month"],
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
          {reconciliations.length === 0 ? (
            <p className="text-slate-500 text-center py-12">No reconciliations found for this period.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Date</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Register Expected</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Register Actual</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Deposit Expected</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Deposit Actual</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Discrepancy</th>
                  <th className="text-center text-xs font-medium text-slate-500 px-6 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reconciliations.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-6 py-3 text-sm text-slate-900">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="px-6 py-3 text-sm text-right text-slate-600">{formatCurrency(r.registerExpected)}</td>
                    <td className="px-6 py-3 text-sm text-right text-slate-900 font-medium">{formatCurrency(r.registerActual)}</td>
                    <td className="px-6 py-3 text-sm text-right text-slate-600">{formatCurrency(r.depositExpected)}</td>
                    <td className="px-6 py-3 text-sm text-right text-slate-900 font-medium">{formatCurrency(r.depositActual)}</td>
                    <td className={cn("px-6 py-3 text-sm text-right font-bold", r.discrepancy === 0 ? "text-green-600" : "text-red-600")}>
                      {r.discrepancy >= 0 ? "+" : ""}{formatCurrency(r.discrepancy)}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {r.discrepancy === 0 ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 inline" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-500 inline" />
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Reconciliation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">New Reconciliation</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                />
              </div>
              {summary && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                  Expected: Register {formatCurrency(summary.registerBalance)} + Deposit {formatCurrency(summary.depositBalance)}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Actual Cash in Register</label>
                <input
                  type="number"
                  step="0.01"
                  value={formRegisterActual}
                  onChange={(e) => setFormRegisterActual(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                  placeholder="Count the register cash"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Actual Cash in Safety Deposit</label>
                <input
                  type="number"
                  step="0.01"
                  value={formDepositActual}
                  onChange={(e) => setFormDepositActual(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                  placeholder="Count the deposit cash"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                  rows={2}
                  placeholder="Any observations"
                />
              </div>
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">{formError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReconcile}
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Reconcile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Set Register Starting Balance</h3>
              <button onClick={() => setShowResetModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Week Starting (Monday)</label>
                <input
                  type="date"
                  value={resetWeekStart}
                  onChange={(e) => setResetWeekStart(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition text-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Starting Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={resetAmount}
                  onChange={(e) => setResetAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition text-slate-900"
                  placeholder="200.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={resetNotes}
                  onChange={(e) => setResetNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition text-slate-900"
                  placeholder="Optional notes"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveReset}
                  disabled={savingReset}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {savingReset ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
