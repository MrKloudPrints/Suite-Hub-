"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Wallet,
  DollarSign,
  X,
  Save,
  Loader2,
  ArrowUpDown,
  Calendar,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { PayoutData } from "@/types";

interface Employee {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

type SortField = "date" | "employee" | "type" | "amount";
type SortDirection = "asc" | "desc";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type DatePreset = "all" | "this_week" | "last_week" | "this_month" | "last_month" | "custom";

function getDateRange(preset: DatePreset): { start: string; end: string } | null {
  if (preset === "all" || preset === "custom") return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const day = now.getDay(); // 0=Sun

  const fmt = (dt: Date) => {
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
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

function formatDate(dateStr: string): string {
  const datePart = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const d = new Date(datePart + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const emptyForm = {
  employeeId: "",
  amount: "",
  type: "ADVANCE" as "ADVANCE" | "LOAN" | "PAYMENT" | "LOAN_REPAYMENT",
  description: "",
  date: todayISO(),
};

export default function PayoutsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payouts, setPayouts] = useState<PayoutData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Sort
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editingPayout, setEditingPayout] = useState<PayoutData | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ─── Fetch employees ───────────────────────────────────────────────
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to load employees");
      const data = await res.json();
      setEmployees(data.filter((e: Employee) => e.active));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  }, []);

  // ─── Fetch payouts ─────────────────────────────────────────────────
  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterEmployeeId !== "all") {
        params.set("employeeId", filterEmployeeId);
      }

      // Date filtering
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

      const res = await fetch(`/api/payouts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load payouts");
      const data = await res.json();
      setPayouts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [filterEmployeeId, datePreset, customStart, customEnd]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  // ─── Sorted payouts ────────────────────────────────────────────────
  const sortedPayouts = useMemo(() => {
    const sorted = [...payouts].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date":
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "employee":
          cmp = (a.employee?.name || a.employee?.code || "").localeCompare(
            b.employee?.name || b.employee?.code || ""
          );
          break;
        case "type":
          cmp = a.type.localeCompare(b.type);
          break;
        case "amount":
          cmp = a.amount - b.amount;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [payouts, sortField, sortDir]);

  // ─── Summary ───────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0);
    const totalAdvances = payouts
      .filter((p) => p.type === "ADVANCE")
      .reduce((sum, p) => sum + p.amount, 0);
    const totalLoans = payouts
      .filter((p) => p.type === "LOAN")
      .reduce((sum, p) => sum + p.amount, 0);
    const totalPayments = payouts
      .filter((p) => p.type === "PAYMENT")
      .reduce((sum, p) => sum + p.amount, 0);
    const totalLoanRepayments = payouts
      .filter((p) => p.type === "LOAN_REPAYMENT")
      .reduce((sum, p) => sum + p.amount, 0);
    return { totalPayouts, totalAdvances, totalLoans, totalPayments, totalLoanRepayments };
  }, [payouts]);

  // ─── Sort toggle ───────────────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // ─── Add payout ────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!addForm.employeeId || !addForm.amount || !addForm.date) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: addForm.employeeId,
          amount: parseFloat(addForm.amount),
          type: addForm.type,
          description: addForm.description,
          date: addForm.date,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create payout");
      }
      await fetchPayouts();
      setShowAddModal(false);
      setAddForm({ ...emptyForm });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payout");
    } finally {
      setSaving(false);
    }
  };

  // ─── Edit payout ───────────────────────────────────────────────────
  const startEdit = (payout: PayoutData) => {
    setEditingPayout(payout);
    setEditForm({
      employeeId: payout.employeeId,
      amount: payout.amount.toString(),
      type: payout.type,
      description: payout.description || "",
      date: payout.date.split("T")[0],
    });
  };

  const handleEdit = async () => {
    if (!editingPayout || !editForm.amount || !editForm.date) return;
    setEditSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/payouts/${editingPayout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(editForm.amount),
          type: editForm.type,
          description: editForm.description,
          date: editForm.date,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update payout");
      }
      await fetchPayouts();
      setEditingPayout(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payout");
    } finally {
      setEditSaving(false);
    }
  };

  // ─── Delete payout ─────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError("");
    try {
      const res = await fetch(`/api/payouts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete payout");
      await fetchPayouts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete payout");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // ─── Helper: employee name ─────────────────────────────────────────
  const empName = (p: PayoutData) =>
    p.employee?.name || p.employee?.code || "Unknown";

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payouts</h1>
          <p className="text-slate-500 mt-1">
            Manage employee advances and loans
          </p>
        </div>
        <button
          onClick={() => {
            setAddForm({ ...emptyForm });
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Payout
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-lg">
              <Wallet className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Payouts
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(summary.totalPayouts)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Payments
              </p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(summary.totalPayments)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Advances
              </p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.totalAdvances)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Loans
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(summary.totalLoans)}
              </p>
              {summary.totalLoanRepayments > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">
                  Repaid: {formatCurrency(summary.totalLoanRepayments)} &middot; Remaining: {formatCurrency(summary.totalLoans - summary.totalLoanRepayments)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Employee Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Employee</label>
            <select
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            >
              <option value="all">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name || emp.code} ({emp.code})
                </option>
              ))}
            </select>
          </div>

          {/* Date Preset */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Date Range</label>
            <div className="flex gap-1.5">
              {([
                ["all", "All Time"],
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
                    "px-3 py-2 text-xs font-medium rounded-lg border transition",
                    datePreset === value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          {datePreset === "custom" && (
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>
            </div>
          )}

          {/* Active filter indicator */}
          {datePreset !== "all" && (
            <button
              onClick={() => { setDatePreset("all"); setCustomStart(""); setCustomEnd(""); }}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition"
            >
              <X className="w-3 h-3" />
              Clear Dates
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Payouts Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : payouts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-slate-600 font-medium">No Payouts Found</h3>
          <p className="text-slate-400 text-sm mt-1">
            Click &quot;Add Payout&quot; to record an advance or loan.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3">
                    <button
                      onClick={() => toggleSort("date")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
                    >
                      Date
                      <ArrowUpDown
                        className={cn(
                          "w-3 h-3",
                          sortField === "date"
                            ? "text-blue-600"
                            : "text-slate-400"
                        )}
                      />
                    </button>
                  </th>
                  <th className="text-left px-5 py-3">
                    <button
                      onClick={() => toggleSort("employee")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
                    >
                      Employee
                      <ArrowUpDown
                        className={cn(
                          "w-3 h-3",
                          sortField === "employee"
                            ? "text-blue-600"
                            : "text-slate-400"
                        )}
                      />
                    </button>
                  </th>
                  <th className="text-left px-5 py-3">
                    <button
                      onClick={() => toggleSort("type")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
                    >
                      Type
                      <ArrowUpDown
                        className={cn(
                          "w-3 h-3",
                          sortField === "type"
                            ? "text-blue-600"
                            : "text-slate-400"
                        )}
                      />
                    </button>
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="text-right px-5 py-3">
                    <button
                      onClick={() => toggleSort("amount")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors ml-auto"
                    >
                      Amount
                      <ArrowUpDown
                        className={cn(
                          "w-3 h-3",
                          sortField === "amount"
                            ? "text-blue-600"
                            : "text-slate-400"
                        )}
                      />
                    </button>
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedPayouts.map((payout) => (
                  <tr
                    key={payout.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-sm text-slate-700">
                      {formatDate(payout.date)}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-900">
                      {empName(payout)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          payout.type === "ADVANCE"
                            ? "bg-green-100 text-green-700"
                            : payout.type === "PAYMENT"
                              ? "bg-emerald-100 text-emerald-700"
                              : payout.type === "LOAN_REPAYMENT"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                        )}
                      >
                        {payout.type === "ADVANCE"
                          ? "Advance"
                          : payout.type === "PAYMENT"
                            ? "Payment"
                            : payout.type === "LOAN_REPAYMENT"
                              ? "Loan Repayment"
                              : "Loan"}
                      </span>
                      {payout.method && (
                        <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          {payout.method}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 max-w-xs truncate">
                      {payout.description || (
                        <span className="text-slate-300 italic">--</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-900 text-right">
                      {formatCurrency(payout.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => startEdit(payout)}
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        {confirmDeleteId === payout.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(payout.id)}
                              disabled={deletingId === payout.id}
                              className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
                            >
                              {deletingId === payout.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                "Confirm"
                              )}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-sm text-slate-400 hover:text-slate-600 font-medium transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(payout.id)}
                            className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td
                    colSpan={4}
                    className="px-5 py-3.5 text-sm font-semibold text-slate-700"
                  >
                    Total ({payouts.length}{" "}
                    {payouts.length === 1 ? "payout" : "payouts"})
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-slate-900 text-right">
                    {formatCurrency(
                      payouts.reduce((sum, p) => sum + p.amount, 0)
                    )}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ─── Add Payout Modal ──────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                Add Payout
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Employee */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Employee <span className="text-red-500">*</span>
                </label>
                <select
                  value={addForm.employeeId}
                  onChange={(e) =>
                    setAddForm({ ...addForm, employeeId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                >
                  <option value="">Select employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name || emp.code} ({emp.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addForm.amount}
                  onChange={(e) =>
                    setAddForm({ ...addForm, amount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                  placeholder="0.00"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setAddForm({ ...addForm, type: "ADVANCE" })}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition",
                      addForm.type === "ADVANCE"
                        ? "bg-green-50 border-green-300 text-green-700"
                        : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Advance
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddForm({ ...addForm, type: "LOAN" })}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition",
                      addForm.type === "LOAN"
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Loan
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={addForm.description}
                  onChange={(e) =>
                    setAddForm({ ...addForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900 resize-none"
                  rows={3}
                  placeholder="Optional description..."
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={addForm.date}
                  onChange={(e) =>
                    setAddForm({ ...addForm, date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !addForm.employeeId || !addForm.amount || !addForm.date}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Add Payout
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Payout Modal ─────────────────────────────────────── */}
      {editingPayout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                Edit Payout
              </h2>
              <button
                onClick={() => setEditingPayout(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Employee (read-only display) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Employee
                </label>
                <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 text-sm">
                  {empName(editingPayout)}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.amount}
                  onChange={(e) =>
                    setEditForm({ ...editForm, amount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                  placeholder="0.00"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setEditForm({ ...editForm, type: "ADVANCE" })
                    }
                    className={cn(
                      "flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition",
                      editForm.type === "ADVANCE"
                        ? "bg-green-50 border-green-300 text-green-700"
                        : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Advance
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, type: "LOAN" })}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition",
                      editForm.type === "LOAN"
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Loan
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900 resize-none"
                  rows={3}
                  placeholder="Optional description..."
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setEditingPayout(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={editSaving || !editForm.amount || !editForm.date}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
