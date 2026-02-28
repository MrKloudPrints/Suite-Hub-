"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Plus,
  Loader2,
  Banknote,
  ArrowDownCircle,
  ArrowUpCircle,
  Pencil,
  Trash2,
  X,
  Vault,
  Wallet,
  CheckCircle2,
  Search,
  Check,
  RefreshCw,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CashEntryData, CashSummaryData, QBOInvoice, QBOPaymentMethod } from "@/types";
import { cn } from "@/lib/utils";

const entryTypeLabels: Record<string, string> = {
  CASH_IN: "Cash In",
  CASH_OUT: "Cash Out",
  DEPOSIT: "To Deposit",
  WITHDRAWAL: "From Deposit",
};

const entryTypeColors: Record<string, string> = {
  CASH_IN: "bg-green-100 text-green-700",
  CASH_OUT: "bg-red-100 text-red-700",
  DEPOSIT: "bg-blue-100 text-blue-700",
  WITHDRAWAL: "bg-amber-100 text-amber-700",
};

const cashOutCategories = ["Labor", "Payout", "Food", "Supplies", "Equipment", "Fuel", "Maintenance", "Other"];
const cashInSources = ["Customer", "Vendor Return", "Refund", "Transfer", "Other"];

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

export default function CashEntriesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [entries, setEntries] = useState<CashEntryData[]>([]);
  const [summary, setSummary] = useState<CashSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CashEntryData | null>(null);

  // Date filter
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Form state
  const [formType, setFormType] = useState("CASH_IN");
  const [formAmount, setFormAmount] = useState(""); // For CASH_IN: amount received from customer
  const [formInvoiceTotal, setFormInvoiceTotal] = useState(""); // Invoice/order total
  const [formRegister, setFormRegister] = useState("");
  const [formDeposit, setFormDeposit] = useState("");
  const [formChange, setFormChange] = useState("");
  const [formCategory, setFormCategory] = useState(""); // CASH_OUT category or CASH_IN source type
  const [formSource, setFormSource] = useState("REGISTER"); // where money goes out from
  const [formCustomer, setFormCustomer] = useState("");
  const [formInvoice, setFormInvoice] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // For employee CASH_OUT: link to an invoice
  const [myInvoices, setMyInvoices] = useState<CashEntryData[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");

  // Employee success state
  const [showSuccess, setShowSuccess] = useState(false);

  // QuickBooks Online state
  const [qboInvoiceId, setQboInvoiceId] = useState<string | null>(null);
  const [qboCustomerId, setQboCustomerId] = useState<string | null>(null);
  const [qboSearch, setQboSearch] = useState("");
  const [qboAllInvoices, setQboAllInvoices] = useState<QBOInvoice[]>([]);
  const [qboLoading, setQboLoading] = useState(false);
  const [qboConnected, setQboConnected] = useState(false);
  const [qboConfigured, setQboConfigured] = useState(false);
  const [cashInMode, setCashInMode] = useState<"qbo" | "manual" | null>(null);
  const [qboPaymentMethods, setQboPaymentMethods] = useState<QBOPaymentMethod[]>([]);
  const [qboPaymentMethodId, setQboPaymentMethodId] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
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
      const [entriesRes, summaryRes] = await Promise.all([
        fetch(`/api/cash/entries?${params}`),
        fetch("/api/cash/summary"),
      ]);
      if (entriesRes.ok) setEntries(await entriesRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [datePreset, customStart, customEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch employee's own CASH_IN entries for linking change
  useEffect(() => {
    if (!isAdmin) {
      fetch("/api/cash/entries")
        .then((res) => (res.ok ? res.json() : []))
        .then((data: CashEntryData[]) => {
          setMyInvoices(
            data.filter(
              (e) => e.type === "CASH_IN" && e.invoiceNumber
            )
          );
        })
        .catch(() => {});
    }
  }, [isAdmin, entries]);

  // Auto-calculate change and register for CASH_IN
  useEffect(() => {
    if (formType === "CASH_IN") {
      const received = parseFloat(formAmount) || 0;
      const invoiceTotal = parseFloat(formInvoiceTotal) || 0;
      const change = Math.max(0, Math.round((received - invoiceTotal) * 100) / 100);
      setFormChange(change > 0 ? change.toFixed(2) : "");
      const dep = parseFloat(formDeposit) || 0;
      setFormRegister((Math.round((received - dep - change) * 100) / 100).toFixed(2));
    }
  }, [formAmount, formInvoiceTotal, formDeposit, formType]);

  // When employee selects an invoice for CASH_OUT, auto-fill fields
  useEffect(() => {
    if (!isAdmin && formType === "CASH_OUT" && selectedInvoiceId) {
      const inv = myInvoices.find((e) => e.id === selectedInvoiceId);
      if (inv) {
        setFormCustomer(inv.customerName || "");
        setFormInvoice(inv.invoiceNumber || "");
      }
    }
  }, [selectedInvoiceId, myInvoices, isAdmin, formType]);

  const resetForm = () => {
    setFormType("CASH_IN");
    setFormAmount("");
    setFormInvoiceTotal("");
    setFormRegister("");
    setFormDeposit("");
    setFormChange("");
    setFormCategory("");
    setFormSource("REGISTER");
    setFormCustomer("");
    setFormInvoice("");
    setFormNotes("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormError("");
    setEditingEntry(null);
    setSelectedInvoiceId("");
    setQboInvoiceId(null);
    setQboCustomerId(null);
    setQboSearch("");
    setCashInMode(null);
    setQboPaymentMethodId("");
  };

  // QBO: load all open invoices on mount
  const fetchQboInvoices = async () => {
    setQboLoading(true);
    try {
      const res = await fetch("/api/quickbooks/invoices");
      const data = await res.json();
      setQboConnected(data.connected === true);
      setQboConfigured(data.configured === true);
      setQboAllInvoices(data.invoices || []);
    } catch { /* */ }
    setQboLoading(false);
  };

  const fetchQboPaymentMethods = async () => {
    try {
      const res = await fetch("/api/quickbooks/payment-methods");
      const data = await res.json();
      setQboPaymentMethods(data.methods || []);
    } catch { /* */ }
  };

  useEffect(() => { fetchQboInvoices(); fetchQboPaymentMethods(); }, []);

  // Filter invoices locally
  const qboFiltered = qboSearch.length > 0
    ? qboAllInvoices.filter((inv) =>
        inv.customerName.toLowerCase().includes(qboSearch.toLowerCase()) ||
        inv.docNumber.toLowerCase().includes(qboSearch.toLowerCase())
      )
    : qboAllInvoices;

  const selectQboInvoice = (inv: QBOInvoice) => {
    setFormInvoiceTotal(String(inv.balance));
    setFormCustomer(inv.customerName);
    setFormInvoice(inv.docNumber);
    setQboInvoiceId(inv.id);
    setQboCustomerId(inv.customerId);
    setFormCategory("Customer");
    setQboSearch("");
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (entry: CashEntryData) => {
    setEditingEntry(entry);
    setFormType(entry.type);
    setFormAmount(entry.amount.toString());
    // Invoice total = amount received - change given
    setFormInvoiceTotal(entry.type === "CASH_IN" && entry.changeGiven > 0
      ? (entry.amount - entry.changeGiven).toString() : "");
    setFormRegister(entry.registerAmount.toString());
    setFormDeposit(entry.depositAmount.toString());
    setFormChange(entry.changeGiven.toString());
    setFormCategory(entry.category || "");
    setFormSource(entry.source || "REGISTER");
    setFormCustomer(entry.customerName || "");
    setFormInvoice(entry.invoiceNumber || "");
    setFormNotes(entry.notes || "");
    setFormDate(new Date(entry.date).toISOString().split("T")[0]);
    setFormError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError("");
    if (formType === "CASH_IN") {
      if (!formAmount || parseFloat(formAmount) <= 0) {
        setFormError("Amount received is required");
        return;
      }
      if (parseFloat(formAmount) < parseFloat(formInvoiceTotal || "0")) {
        setFormError("Amount received can't be less than invoice total");
        return;
      }
    } else if (!formAmount || parseFloat(formAmount) <= 0) {
      setFormError("Amount must be greater than 0");
      return;
    }

    // Employee CASH_OUT must be linked to an invoice
    if (!isAdmin && formType === "CASH_OUT" && !selectedInvoiceId) {
      setFormError("Please select the invoice this change is for");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        type: formType,
        amount: formAmount,
        registerAmount: formType === "CASH_IN" ? formRegister : formAmount,
        depositAmount: formType === "CASH_IN" ? formDeposit : "0",
        changeGiven: formType === "CASH_IN" ? formChange : "0",
        category: formCategory || null,
        source: formSource,
        customerName: formCustomer,
        invoiceNumber: formInvoice,
        notes: formNotes,
        date: formDate,
      };

      // For CASH_OUT, the register/deposit amounts depend on source
      if (formType === "CASH_OUT") {
        if (formSource === "REGISTER") {
          payload.registerAmount = formAmount;
          payload.depositAmount = "0";
        } else {
          payload.registerAmount = "0";
          payload.depositAmount = formAmount;
        }
      }

      // For transfers, register/deposit amounts mirror the amount
      if (formType === "DEPOSIT") {
        payload.registerAmount = formAmount; // leaves register
        payload.depositAmount = formAmount;  // enters deposit
        payload.changeGiven = "0";
      }
      if (formType === "WITHDRAWAL") {
        payload.registerAmount = formAmount; // enters register
        payload.depositAmount = formAmount;  // leaves deposit
        payload.changeGiven = "0";
      }

      const url = editingEntry ? `/api/cash/entries/${editingEntry.id}` : "/api/cash/entries";
      const method = editingEntry ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      // Record payment in QuickBooks if linked to a QBO invoice
      if (formType === "CASH_IN" && qboInvoiceId && qboCustomerId) {
        try {
          await fetch("/api/quickbooks/payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoiceId: qboInvoiceId,
              customerId: qboCustomerId,
              amount: parseFloat(formInvoiceTotal) || parseFloat(formAmount) || 0,
              paymentMethodId: qboPaymentMethodId || undefined,
            }),
          });
        } catch { /* non-blocking */ }
      }

      if (isAdmin) {
        setShowModal(false);
      } else {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
      resetForm();
      fetchData();
      // Refresh QBO invoices list after payment
      if (qboInvoiceId) fetchQboInvoices();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    try {
      await fetch(`/api/cash/entries/${id}`, { method: "DELETE" });
      fetchData();
    } catch {
      alert("Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // ─── Source Toggle Component ──────────────────────────────────────
  const SourceToggle = () => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">From Where?</label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFormSource("REGISTER")}
          className={cn(
            "flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition",
            formSource === "REGISTER"
              ? "bg-emerald-600 text-white border-emerald-600"
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
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
          )}
        >
          Safety Deposit
        </button>
      </div>
    </div>
  );

  // ─── Employee View ─────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cash Entry</h1>
          <p className="text-slate-500 mt-1">Record a cash transaction</p>
        </div>

        {showSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-5 py-3 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Entry recorded successfully!
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-lg">
          <div className="space-y-4">
            {/* Type — employees can only do CASH_IN or CASH_OUT */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setFormType("CASH_IN"); setSelectedInvoiceId(""); setFormCategory("Customer"); }}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border transition ${
                    formType === "CASH_IN"
                      ? "bg-green-50 border-green-300 text-green-700"
                      : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <ArrowDownCircle className="w-4 h-4" />
                  Cash In
                </button>
                <button
                  type="button"
                  onClick={() => { setFormType("CASH_OUT"); setFormCategory(""); }}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border transition ${
                    formType === "CASH_OUT"
                      ? "bg-red-50 border-red-300 text-red-700"
                      : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  Cash Out
                </button>
              </div>
            </div>

            {/* CASH_OUT fields */}
            {formType === "CASH_OUT" && (
              <>
                {/* Link to invoice for employees */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    For Invoice <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                  >
                    <option value="">Select an invoice...</option>
                    {myInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} — {inv.customerName || "No name"} ({formatCurrency(inv.amount)})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Change must be linked to the original invoice</p>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                  >
                    <option value="">Select category...</option>
                    {cashOutCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Source: register or deposit */}
                <SourceToggle />
              </>
            )}

            {/* CASH_IN: mode selector + source type */}
            {formType === "CASH_IN" && (
              <>
                {qboConfigured && !cashInMode && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Entry Method</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => { setCashInMode("qbo"); setFormCategory("Customer"); }}
                        className="flex flex-col items-center gap-2 px-4 py-4 rounded-lg text-sm font-medium border-2 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                      >
                        <Search className="w-5 h-5" />
                        Import from QuickBooks
                      </button>
                      <button
                        type="button"
                        onClick={() => setCashInMode("manual")}
                        className="flex flex-col items-center gap-2 px-4 py-4 rounded-lg text-sm font-medium border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
                      >
                        <Banknote className="w-5 h-5" />
                        Enter Manually
                      </button>
                    </div>
                  </div>
                )}

                {cashInMode === "qbo" && qboConfigured && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-slate-700">Search QuickBooks Invoice</label>
                      <button type="button" onClick={() => { setCashInMode("manual"); setQboSearch(""); setQboInvoiceId(null); setQboCustomerId(null); }}
                        className="text-xs text-slate-500 hover:text-slate-700 underline">Switch to manual</button>
                    </div>
                    {!qboConnected ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                        <p className="text-amber-700 text-sm font-medium">QuickBooks Not Connected</p>
                        <p className="text-amber-600 text-xs mt-1">Go to Settings &rarr; QuickBooks Online &rarr; Connect QuickBooks</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Filter by name or invoice #..."
                              value={qboSearch}
                              onChange={(e) => setQboSearch(e.target.value)}
                              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                            />
                          </div>
                          <button type="button" onClick={fetchQboInvoices} disabled={qboLoading}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition">
                            {qboLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          </button>
                        </div>
                        {qboLoading ? (
                          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-emerald-500 animate-spin" /></div>
                        ) : qboFiltered.length > 0 ? (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50">
                            {qboFiltered.map((inv) => (
                              <button key={inv.id} type="button" onClick={() => selectQboInvoice(inv)}
                                className={cn("w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 transition text-sm",
                                  qboInvoiceId === inv.id && "bg-emerald-50 ring-1 ring-emerald-300")}>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="font-medium text-slate-900">#{inv.docNumber}</span>
                                    <span className="text-slate-500 ml-2">{inv.customerName}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-semibold text-emerald-600">{formatCurrency(inv.balance)}</span>
                                    {inv.totalAmt !== inv.balance && (
                                      <span className="text-xs text-amber-500 ml-1">of {formatCurrency(inv.totalAmt)}</span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : qboAllInvoices.length === 0 ? (
                          <p className="text-center text-slate-400 text-sm py-3">No open invoices in QuickBooks</p>
                        ) : (
                          <p className="text-center text-slate-400 text-sm py-3">No invoices match &ldquo;{qboSearch}&rdquo;</p>
                        )}
                        {qboInvoiceId && (
                          <>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                              <p className="text-xs text-emerald-700">QBO Invoice #{formInvoice} linked &mdash; payment will sync on save</p>
                            </div>
                            {qboPaymentMethods.length > 0 && (
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method (QuickBooks)</label>
                                <div className="flex gap-1.5 flex-wrap">
                                  {qboPaymentMethods.map((m) => (
                                    <button key={m.id} type="button" onClick={() => setQboPaymentMethodId(m.id === qboPaymentMethodId ? "" : m.id)}
                                      className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition",
                                        qboPaymentMethodId === m.id
                                          ? "bg-emerald-600 text-white border-emerald-600"
                                          : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                                      )}>
                                      {m.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {(cashInMode === "manual" || !qboConfigured) && (
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cash From</label>
                      {cashInMode === "manual" && qboConfigured && (
                        <button type="button" onClick={() => setCashInMode("qbo")}
                          className="text-xs text-slate-500 hover:text-slate-700 underline mb-1">Switch to QuickBooks</button>
                      )}
                    </div>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                    >
                      {cashInSources.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
              />
            </div>

            {formType === "CASH_IN" ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Total</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formInvoiceTotal}
                    onChange={(e) => setFormInvoiceTotal(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                    placeholder="Order total"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount Received</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                    placeholder="Cash handed over"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                  placeholder="0.00"
                />
              </div>
            )}

            {formType === "CASH_IN" && (
              <>
                {/* Customer/Invoice fields — show for "Customer" source */}
                {formCategory === "Customer" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
                      <input
                        type="text"
                        value={formCustomer}
                        onChange={(e) => setFormCustomer(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                        placeholder="Customer name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Invoice #</label>
                      <input
                        type="text"
                        value={formInvoice}
                        onChange={(e) => setFormInvoice(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                        placeholder="INV-001"
                      />
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700">Split Distribution</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">To Deposit</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formDeposit}
                        onChange={(e) => setFormDeposit(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Change Due</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formChange}
                        readOnly
                        className={cn(
                          "w-full px-3 py-2 border rounded-lg text-sm",
                          parseFloat(formChange) > 0
                            ? "border-amber-200 bg-amber-50 text-amber-700 font-medium"
                            : "border-slate-200 bg-slate-100 text-slate-500"
                        )}
                        placeholder="Auto"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        {parseFloat(formRegister) < 0 ? "From Register" : "To Register"}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formRegister}
                        readOnly
                        className={cn(
                          "w-full px-3 py-2 border rounded-lg text-sm",
                          parseFloat(formRegister) < 0
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-slate-200 bg-slate-100 text-slate-700"
                        )}
                      />
                    </div>
                  </div>
                  {/* Where is change coming from? */}
                  {parseFloat(formChange) > 0 && (
                    <div className="pt-2 border-t border-slate-200">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Change from where?</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormSource("REGISTER")}
                          className={cn(
                            "flex-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition",
                            formSource === "REGISTER"
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                          )}
                        >
                          Register
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormSource("DEPOSIT")}
                          className={cn(
                            "flex-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition",
                            formSource === "DEPOSIT"
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                          )}
                        >
                          Safety Deposit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                rows={2}
                placeholder="Optional notes"
              />
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
              {formType === "CASH_OUT" ? "Record Cash Out" : "Record Entry"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Admin View ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Summary Cards — computed from filtered entries */}
      {(() => {
        const totalCashIn = entries.filter((e) => e.type === "CASH_IN").reduce((s, e) => s + e.amount, 0);
        const totalCashOut = entries.filter((e) => e.type === "CASH_OUT").reduce((s, e) => s + e.amount, 0);
        const totalDeposits = entries.filter((e) => e.type === "DEPOSIT").reduce((s, e) => s + e.amount, 0);
        const totalWithdrawals = entries.filter((e) => e.type === "WITHDRAWAL").reduce((s, e) => s + e.amount, 0);
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ArrowDownCircle className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-sm text-slate-500">Total Cash In</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCashIn)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <ArrowUpCircle className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-sm text-slate-500">Total Cash Out</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalCashOut)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Vault className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm text-slate-500">To Deposit</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalDeposits)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Wallet className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-sm text-slate-500">From Deposit</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalWithdrawals)}</p>
            </div>
          </div>
        );
      })()}

      {/* Entries Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Banknote className="w-5 h-5 text-emerald-600" />
              </div>
              <h2 className="font-semibold text-slate-900">Cash Entries</h2>
            </div>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
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
                    ? "bg-emerald-600 text-white border-emerald-600"
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
                  className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          {entries.length === 0 ? (
            <p className="text-slate-500 text-center py-12">No cash entries yet. Click &quot;Add Entry&quot; to get started.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Type</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Category</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Source</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Customer</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">Invoice</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Amount</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Register</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Deposit</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Change</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-6 py-3">By</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-6 py-3 text-sm text-slate-900">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${entryTypeColors[entry.type]}`}>
                        {entryTypeLabels[entry.type]}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600">{entry.category || "—"}</td>
                    <td className="px-6 py-3">
                      {(entry.type === "CASH_OUT" || entry.changeGiven > 0) && (
                        <span className={cn(
                          "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                          entry.source === "DEPOSIT" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                        )}>
                          {entry.source === "DEPOSIT" ? "Deposit" : "Register"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600">{entry.customerName || "—"}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{entry.invoiceNumber || "—"}</td>
                    <td className="px-6 py-3 text-sm text-right font-medium text-slate-900">{formatCurrency(entry.amount)}</td>
                    <td className="px-6 py-3 text-sm text-right text-slate-600">{formatCurrency(entry.registerAmount)}</td>
                    <td className="px-6 py-3 text-sm text-right text-slate-600">{formatCurrency(entry.depositAmount)}</td>
                    <td className="px-6 py-3 text-sm text-right text-slate-600">{formatCurrency(entry.changeGiven)}</td>
                    <td className="px-6 py-3 text-sm text-slate-500">{entry.user?.username || "—"}</td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(entry)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(entry.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
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
                {editingEntry ? "Edit Entry" : "Add Cash Entry"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                >
                  <option value="CASH_IN">Cash In</option>
                  <option value="CASH_OUT">Cash Out</option>
                  <option value="DEPOSIT">To Safety Deposit</option>
                  <option value="WITHDRAWAL">From Safety Deposit</option>
                </select>
              </div>

              {/* CASH_OUT: category + source */}
              {formType === "CASH_OUT" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                    >
                      <option value="">Select category...</option>
                      {cashOutCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <SourceToggle />
                </>
              )}

              {/* CASH_IN: mode selector + source type */}
              {formType === "CASH_IN" && (
                <>
                  {/* Mode selector — only show when QBO is configured and no mode chosen yet */}
                  {qboConfigured && !cashInMode && !editingEntry && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Entry Method</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => { setCashInMode("qbo"); setFormCategory("Customer"); }}
                          className="flex flex-col items-center gap-2 px-4 py-4 rounded-lg text-sm font-medium border-2 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                        >
                          <Search className="w-5 h-5" />
                          Import from QuickBooks
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashInMode("manual")}
                          className="flex flex-col items-center gap-2 px-4 py-4 rounded-lg text-sm font-medium border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
                        >
                          <Banknote className="w-5 h-5" />
                          Enter Manually
                        </button>
                      </div>
                    </div>
                  )}

                  {/* QBO invoices — shown when QBO mode selected */}
                  {cashInMode === "qbo" && qboConfigured && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-slate-700">Select QuickBooks Invoice</label>
                        <button type="button" onClick={() => { setCashInMode("manual"); setQboSearch(""); setQboInvoiceId(null); setQboCustomerId(null); }}
                          className="text-xs text-slate-500 hover:text-slate-700 underline">Switch to manual</button>
                      </div>
                      {!qboConnected ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                          <p className="text-amber-700 text-sm font-medium">QuickBooks Not Connected</p>
                          <p className="text-amber-600 text-xs mt-1">Go to Settings &rarr; QuickBooks Online &rarr; Connect QuickBooks</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Filter by name or invoice #..."
                                value={qboSearch}
                                onChange={(e) => setQboSearch(e.target.value)}
                                autoFocus
                                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                              />
                            </div>
                            <button type="button" onClick={fetchQboInvoices} disabled={qboLoading}
                              className="px-3 py-2 border border-slate-300 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition">
                              {qboLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            </button>
                          </div>
                          {qboLoading ? (
                            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-emerald-500 animate-spin" /></div>
                          ) : qboFiltered.length > 0 ? (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50">
                              {qboFiltered.map((inv) => (
                                <button key={inv.id} type="button" onClick={() => selectQboInvoice(inv)}
                                  className={cn("w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 transition text-sm",
                                    qboInvoiceId === inv.id && "bg-emerald-50 ring-1 ring-emerald-300")}>
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="font-medium text-slate-900">#{inv.docNumber}</span>
                                      <span className="text-slate-500 ml-2">{inv.customerName}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-semibold text-emerald-600">{formatCurrency(inv.balance)}</span>
                                      {inv.totalAmt !== inv.balance && (
                                        <span className="text-xs text-amber-500 ml-1">of {formatCurrency(inv.totalAmt)}</span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : qboAllInvoices.length === 0 ? (
                            <p className="text-center text-slate-400 text-sm py-3">No open invoices in QuickBooks</p>
                          ) : (
                            <p className="text-center text-slate-400 text-sm py-3">No invoices match &ldquo;{qboSearch}&rdquo;</p>
                          )}
                          {qboInvoiceId && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                              <p className="text-xs text-emerald-700">QBO Invoice #{formInvoice} linked &mdash; payment will sync on save</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Manual mode: show Cash From selector */}
                  {(cashInMode === "manual" || editingEntry || !qboConfigured) && (
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Cash From</label>
                        {cashInMode === "manual" && qboConfigured && (
                          <button type="button" onClick={() => setCashInMode("qbo")}
                            className="text-xs text-slate-500 hover:text-slate-700 underline mb-1">Switch to QuickBooks</button>
                        )}
                      </div>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                      >
                        <option value="">Select source...</option>
                        {cashInSources.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* CASH_OUT: already handled above */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                />
              </div>

              {formType === "CASH_IN" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Total</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formInvoiceTotal}
                      onChange={(e) => setFormInvoiceTotal(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                      placeholder="Order total"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount Received</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                      placeholder="Cash handed over"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                    placeholder="0.00"
                  />
                </div>
              )}

              {formType === "CASH_IN" && (
                <>
                  {formCategory === "Customer" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
                        <input
                          type="text"
                          value={formCustomer}
                          onChange={(e) => setFormCustomer(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                          placeholder="Customer name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Invoice #</label>
                        <input
                          type="text"
                          value={formInvoice}
                          onChange={(e) => setFormInvoice(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                          placeholder="INV-001"
                        />
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium text-slate-700">Split Distribution</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">To Deposit</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formDeposit}
                          onChange={(e) => setFormDeposit(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Change Due</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formChange}
                          readOnly
                          className={cn(
                            "w-full px-3 py-2 border rounded-lg text-sm",
                            parseFloat(formChange) > 0
                              ? "border-amber-200 bg-amber-50 text-amber-700 font-medium"
                              : "border-slate-200 bg-slate-100 text-slate-500"
                          )}
                          placeholder="Auto"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">
                          {parseFloat(formRegister) < 0 ? "From Register" : "To Register"}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formRegister}
                          readOnly
                          className={cn(
                            "w-full px-3 py-2 border rounded-lg text-sm",
                            parseFloat(formRegister) < 0
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-slate-200 bg-slate-100 text-slate-700"
                          )}
                        />
                      </div>
                    </div>
                    {/* Where is change coming from? */}
                    {parseFloat(formChange) > 0 && (
                      <div className="pt-2 border-t border-slate-200">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Change from where?</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setFormSource("REGISTER")}
                            className={cn(
                              "flex-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition",
                              formSource === "REGISTER"
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                            )}
                          >
                            Register
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormSource("DEPOSIT")}
                            className={cn(
                              "flex-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition",
                              formSource === "DEPOSIT"
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                            )}
                          >
                            Safety Deposit
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Customer/Invoice fields for CASH_OUT (admin can fill these) */}
              {formType === "CASH_OUT" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
                    <input
                      type="text"
                      value={formCustomer}
                      onChange={(e) => setFormCustomer(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Invoice #</label>
                    <input
                      type="text"
                      value={formInvoice}
                      onChange={(e) => setFormInvoice(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                      placeholder="Optional"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-900"
                  rows={2}
                  placeholder="Optional notes"
                />
              </div>

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
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editingEntry ? "Update" : "Add Entry"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
