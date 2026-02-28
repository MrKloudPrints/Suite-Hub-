"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Plus,
  Loader2,
  Receipt,
  Pencil,
  Trash2,
  X,
  Upload,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ExpenseData } from "@/types";
import { cn } from "@/lib/utils";

const categories = ["General", "Labor", "Supplies", "Fuel", "Food", "Equipment", "Maintenance", "Utilities", "Other"];

type DatePreset = "all" | "this_week" | "last_week" | "this_month" | "last_month" | "custom";

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
  if (preset === "last_month") {
    return { start: fmt(new Date(y, m - 1, 1)), end: fmt(new Date(y, m, 0)) };
  }
  return null;
}

export default function ExpensesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseData | null>(null);
  const [filterCategory, setFilterCategory] = useState("");

  // Date filter
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Form state
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("General");
  const [formSource, setFormSource] = useState("REGISTER");
  const [formPaidBy, setFormPaidBy] = useState("");
  const [formOutOfPocket, setFormOutOfPocket] = useState(false);
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formReceipt, setFormReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Employee success state
  const [showSuccess, setShowSuccess] = useState(false);

  const fetchExpenses = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
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
      const res = await fetch(`/api/cash/expenses?${params}`);
      if (res.ok) setExpenses(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterCategory, datePreset, customStart, customEnd]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const resetForm = () => {
    setFormAmount("");
    setFormDescription("");
    setFormCategory("General");
    setFormSource("REGISTER");
    setFormPaidBy("");
    setFormOutOfPocket(false);
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormReceipt(null);
    setFormError("");
    setEditingExpense(null);
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (expense: ExpenseData) => {
    setEditingExpense(expense);
    setFormAmount(expense.amount.toString());
    setFormDescription(expense.description);
    setFormCategory(expense.category);
    setFormSource(expense.source || "REGISTER");
    setFormPaidBy(expense.paidByName);
    setFormOutOfPocket(expense.outOfPocket);
    setFormDate(new Date(expense.date).toISOString().split("T")[0]);
    setFormReceipt(null);
    setFormError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError("");
    if (!formAmount || parseFloat(formAmount) <= 0) { setFormError("Amount required"); return; }
    if (!formDescription.trim()) { setFormError("Description required"); return; }

    setSaving(true);
    try {
      if (editingExpense) {
        const res = await fetch(`/api/cash/expenses/${editingExpense.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: formAmount,
            description: formDescription,
            category: formCategory,
            source: formSource,
            paidByName: formPaidBy,
            outOfPocket: formOutOfPocket,
            date: formDate,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update");
        }
      } else {
        const fd = new FormData();
        fd.append("amount", formAmount);
        fd.append("description", formDescription);
        fd.append("category", formCategory);
        fd.append("source", formSource);
        fd.append("paidByName", formPaidBy);
        fd.append("outOfPocket", formOutOfPocket.toString());
        fd.append("date", formDate);
        if (formReceipt) fd.append("receipt", formReceipt);

        const res = await fetch("/api/cash/expenses", { method: "POST", body: fd });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create");
        }
      }

      if (isAdmin) {
        setShowModal(false);
      } else {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
      resetForm();
      fetchExpenses();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await fetch(`/api/cash/expenses/${id}`, { method: "DELETE" });
      fetchExpenses();
    } catch {
      alert("Failed to delete");
    }
  };

  const handleToggleReimbursed = async (expense: ExpenseData) => {
    if (!isAdmin) return;
    try {
      await fetch(`/api/cash/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reimbursed: !expense.reimbursed }),
      });
      fetchExpenses();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // ─── Employee View ─────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Log Expense</h1>
          <p className="text-slate-500 mt-1">Record a business expense</p>
        </div>

        {showSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-5 py-3 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Expense recorded successfully!
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-lg">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-slate-900"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-slate-900"
                placeholder="What was this expense for?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormSource("REGISTER")}
                  className={cn(
                    "flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition",
                    formSource === "REGISTER"
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  )}
                >
                  Register
                </button>
                <button
                  type="button"
                  onClick={() => setFormSource("DEPOSIT")}
                  className={cn(
                    "flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition",
                    formSource === "DEPOSIT"
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  )}
                >
                  Safety Deposit
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-slate-900"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Paid By</label>
                <input
                  type="text"
                  value={formPaidBy}
                  onChange={(e) => setFormPaidBy(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-slate-900"
                  placeholder="Who paid?"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formOutOfPocket}
                  onChange={(e) => setFormOutOfPocket(e.target.checked)}
                  className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500"
                />
                <span className="text-sm text-slate-700">Out of Pocket (needs reimbursement)</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Receipt</label>
              <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-orange-400 transition text-sm text-slate-500">
                <Upload className="w-4 h-4" />
                {formReceipt ? formReceipt.name : "Click to upload receipt"}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => setFormReceipt(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
              Record Expense
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Admin View ────────────────────────────────────────────────────
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const fromRegister = expenses.filter((e) => e.source !== "DEPOSIT" && !e.outOfPocket).reduce((sum, e) => sum + e.amount, 0);
  const fromDeposit = expenses.filter((e) => e.source === "DEPOSIT" && !e.outOfPocket).reduce((sum, e) => sum + e.amount, 0);
  const outOfPocketTotal = expenses.filter((e) => e.outOfPocket).reduce((sum, e) => sum + e.amount, 0);
  const unreimbursed = expenses.filter((e) => e.outOfPocket && !e.reimbursed).reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-sm text-slate-500 mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalExpenses)}</p>
          <p className="text-xs text-slate-400 mt-1">{expenses.length} expense{expenses.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-sm text-slate-500 mb-1">From Register</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(fromRegister)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-sm text-slate-500 mb-1">From Deposit</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(fromDeposit)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-sm text-slate-500 mb-1">Out of Pocket</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(outOfPocketTotal)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-sm text-slate-500 mb-1">Unreimbursed</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(unreimbursed)}</p>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Receipt className="w-5 h-5 text-orange-600" />
              </div>
              <h2 className="font-semibold text-slate-900">Expenses</h2>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={openAdd}
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition"
              >
                <Plus className="w-4 h-4" />
                Add Expense
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {([
              ["all", "All"],
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
                    ? "bg-orange-600 text-white border-orange-600"
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
                  className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-orange-500"
                />
              </>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          {expenses.length === 0 ? (
            <p className="text-slate-500 text-center py-12">No expenses yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Description</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Category</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Source</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Amount</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Paid By</th>
                  <th className="text-center text-xs font-medium text-slate-500 px-6 py-3">OOP</th>
                  <th className="text-center text-xs font-medium text-slate-500 px-6 py-3">Reimbursed</th>
                  <th className="text-center text-xs font-medium text-slate-500 px-6 py-3">Receipt</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-6 py-3 text-sm text-slate-900">
                      {new Date(expense.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-900">{expense.description}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={cn(
                        "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                        expense.source === "DEPOSIT" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                      )}>
                        {expense.source === "DEPOSIT" ? "Deposit" : "Register"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-medium text-slate-900">{formatCurrency(expense.amount)}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{expense.paidByName || expense.user?.username || "—"}</td>
                    <td className="px-6 py-3 text-center">
                      {expense.outOfPocket && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Yes</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {expense.outOfPocket && (
                        <button
                          onClick={() => handleToggleReimbursed(expense)}
                          className={cn("p-1 rounded", expense.reimbursed ? "text-green-600" : "text-slate-300")}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {expense.receiptPath && (
                        <a href={expense.receiptPath} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                          <ExternalLink className="w-4 h-4 inline" />
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(expense)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(expense.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Modal (Admin) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingExpense ? "Edit Expense" : "Add Expense"}
              </h3>
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-slate-900"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-slate-900"
                  placeholder="What was this expense for?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormSource("REGISTER")}
                    className={cn(
                      "flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition",
                      formSource === "REGISTER"
                        ? "bg-orange-600 text-white border-orange-600"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSource("DEPOSIT")}
                    className={cn(
                      "flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition",
                      formSource === "DEPOSIT"
                        ? "bg-orange-600 text-white border-orange-600"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    Safety Deposit
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-slate-900"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Paid By</label>
                  <input
                    type="text"
                    value={formPaidBy}
                    onChange={(e) => setFormPaidBy(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-slate-900"
                    placeholder="Who paid?"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formOutOfPocket}
                    onChange={(e) => setFormOutOfPocket(e.target.checked)}
                    className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-700">Out of Pocket (needs reimbursement)</span>
                </label>
              </div>
              {!editingExpense && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Receipt</label>
                  <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-orange-400 transition text-sm text-slate-500">
                    <Upload className="w-4 h-4" />
                    {formReceipt ? formReceipt.name : "Click to upload receipt"}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => setFormReceipt(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              )}
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
                  {formError}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editingExpense ? "Update" : "Add Expense"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
