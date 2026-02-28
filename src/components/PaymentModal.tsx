"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Banknote, Smartphone, FileCheck, AlertCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface PaymentModalProps {
  employeeId: string;
  employeeName: string;
  netPay: number;
  date: string; // ISO date string for the payout
  onClose: () => void;
  onSuccess: () => void;
}

interface LoanInfo {
  totalLoaned: number;
  totalRepaid: number;
  remaining: number;
}

type PayMethod = "CASH" | "ZELLE" | "CHECK";

const methodConfig: Record<PayMethod, { label: string; icon: typeof Banknote; color: string; activeColor: string }> = {
  CASH: { label: "Cash", icon: Banknote, color: "text-green-600", activeColor: "bg-green-50 border-green-300 text-green-700" },
  ZELLE: { label: "Zelle", icon: Smartphone, color: "text-purple-600", activeColor: "bg-purple-50 border-purple-300 text-purple-700" },
  CHECK: { label: "Check", icon: FileCheck, color: "text-blue-600", activeColor: "bg-blue-50 border-blue-300 text-blue-700" },
};

export function PaymentModal({ employeeId, employeeName, netPay, date, onClose, onSuccess }: PaymentModalProps) {
  const [method, setMethod] = useState<PayMethod>("CASH");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitMethod, setSplitMethod] = useState<PayMethod>("ZELLE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Loan repayment state
  const [loanInfo, setLoanInfo] = useState<LoanInfo | null>(null);
  const [loanRepayEnabled, setLoanRepayEnabled] = useState(false);
  const [loanRepayAmount, setLoanRepayAmount] = useState("0.00");

  // Compute payable amount (net pay minus loan repayment)
  const repayAmount = loanRepayEnabled ? (parseFloat(loanRepayAmount) || 0) : 0;
  const payableAmount = Math.max(0, netPay - repayAmount);

  // Payment amounts
  const [cashAmount, setCashAmount] = useState(netPay.toFixed(2));
  const [splitAmount, setSplitAmount] = useState("0.00");

  // Fetch employee's outstanding loans
  useEffect(() => {
    async function fetchLoans() {
      try {
        const res = await fetch(`/api/payouts?employeeId=${employeeId}`);
        if (res.ok) {
          const data: { type: string; amount: number }[] = await res.json();
          const totalLoaned = data
            .filter((p) => p.type === "LOAN")
            .reduce((sum, p) => sum + p.amount, 0);
          const totalRepaid = data
            .filter((p) => p.type === "LOAN_REPAYMENT")
            .reduce((sum, p) => sum + p.amount, 0);
          const remaining = totalLoaned - totalRepaid;
          if (totalLoaned > 0) {
            setLoanInfo({ totalLoaned, totalRepaid, remaining });
          }
        }
      } catch {
        // ignore — loan info is optional
      }
    }
    fetchLoans();
  }, [employeeId]);

  // Update cash amount when payable changes
  useEffect(() => {
    if (!splitEnabled) {
      setCashAmount(payableAmount.toFixed(2));
      setSplitAmount("0.00");
    } else {
      // Keep cash amount, recalc split
      const cash = parseFloat(cashAmount) || 0;
      const remaining = Math.max(0, payableAmount - cash);
      setSplitAmount(remaining.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payableAmount, splitEnabled]);

  // Auto-calc split when cash amount changes
  useEffect(() => {
    if (splitEnabled) {
      const cash = parseFloat(cashAmount) || 0;
      const remaining = Math.max(0, payableAmount - cash);
      setSplitAmount(remaining.toFixed(2));
    }
  }, [cashAmount, payableAmount, splitEnabled]);

  // Ensure split method differs from main method
  useEffect(() => {
    if (splitMethod === method) {
      const others = (["CASH", "ZELLE", "CHECK"] as PayMethod[]).filter(m => m !== method);
      setSplitMethod(others[0]);
    }
  }, [method, splitMethod]);

  // Reset loan repay amount when toggled off
  useEffect(() => {
    if (!loanRepayEnabled) {
      setLoanRepayAmount("0.00");
    }
  }, [loanRepayEnabled]);

  const handleSubmit = async () => {
    setError("");
    const mainAmount = parseFloat(cashAmount);
    const secondAmount = splitEnabled ? parseFloat(splitAmount) : 0;
    const repay = loanRepayEnabled ? (parseFloat(loanRepayAmount) || 0) : 0;

    if (mainAmount <= 0 && secondAmount <= 0 && repay <= 0) {
      setError("Payment amount must be greater than 0");
      return;
    }

    if (repay > 0 && loanInfo && repay > loanInfo.remaining) {
      setError(`Repayment amount cannot exceed remaining loan balance (${formatCurrency(loanInfo.remaining)})`);
      return;
    }

    setSaving(true);
    try {
      // Create main payment
      if (mainAmount > 0) {
        const res = await fetch("/api/payouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId,
            amount: mainAmount,
            type: "PAYMENT",
            method,
            description: `Payment via ${methodConfig[method].label}`,
            date,
          }),
        });
        if (!res.ok) throw new Error("Failed to create payment");
      }

      // Create split payment if enabled
      if (splitEnabled && secondAmount > 0) {
        const res = await fetch("/api/payouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId,
            amount: secondAmount,
            type: "PAYMENT",
            method: splitMethod,
            description: `Payment via ${methodConfig[splitMethod].label} (split)`,
            date,
          }),
        });
        if (!res.ok) throw new Error("Failed to create split payment");
      }

      // Create loan repayment if enabled
      if (repay > 0) {
        const res = await fetch("/api/payouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId,
            amount: repay,
            type: "LOAN_REPAYMENT",
            description: `Loan repayment (from paycheck)`,
            date,
          }),
        });
        if (!res.ok) throw new Error("Failed to record loan repayment");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process payment");
    } finally {
      setSaving(false);
    }
  };

  const totalPayment = (parseFloat(cashAmount) || 0) + (splitEnabled ? parseFloat(splitAmount) || 0 : 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Record Payment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Employee + Amount Info */}
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm text-slate-500">Paying</p>
            <p className="text-lg font-bold text-slate-900">{employeeName}</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(netPay)}</p>
            {repayAmount > 0 && (
              <p className="text-sm text-slate-500 mt-1">
                After loan repayment: <span className="font-semibold text-slate-700">{formatCurrency(payableAmount)}</span>
              </p>
            )}
          </div>

          {/* Outstanding Loan Info */}
          {loanInfo && loanInfo.remaining > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">Outstanding Loan</p>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-amber-600">Original</p>
                      <p className="font-bold text-amber-900">{formatCurrency(loanInfo.totalLoaned)}</p>
                    </div>
                    <div>
                      <p className="text-amber-600">Repaid</p>
                      <p className="font-bold text-amber-900">{formatCurrency(loanInfo.totalRepaid)}</p>
                    </div>
                    <div>
                      <p className="text-amber-600">Remaining</p>
                      <p className="font-bold text-amber-900">{formatCurrency(loanInfo.remaining)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Loan Repayment Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-amber-200">
                <label className="text-sm font-medium text-amber-800">Include Loan Repayment</label>
                <button
                  onClick={() => setLoanRepayEnabled(!loanRepayEnabled)}
                  className={cn(
                    "relative w-11 h-6 rounded-full transition-colors",
                    loanRepayEnabled ? "bg-amber-500" : "bg-slate-200"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                      loanRepayEnabled && "translate-x-5"
                    )}
                  />
                </button>
              </div>

              {loanRepayEnabled && (
                <div>
                  <label className="block text-xs font-medium text-amber-700 mb-1">
                    Repayment Amount (max {formatCurrency(loanInfo.remaining)})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={loanInfo.remaining}
                    value={loanRepayAmount}
                    onChange={(e) => setLoanRepayAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition text-slate-900 bg-white"
                  />
                </div>
              )}
            </div>
          )}

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {(["CASH", "ZELLE", "CHECK"] as PayMethod[]).map((m) => {
                const config = methodConfig[m];
                const Icon = config.icon;
                return (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-medium border transition",
                      method === m
                        ? config.activeColor
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Split Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Split Payment</label>
            <button
              onClick={() => setSplitEnabled(!splitEnabled)}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors",
                splitEnabled ? "bg-blue-600" : "bg-slate-200"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                  splitEnabled && "translate-x-5"
                )}
              />
            </button>
          </div>

          {/* Amount Fields */}
          {splitEnabled ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {methodConfig[method].label} Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Second Method
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {(["CASH", "ZELLE", "CHECK"] as PayMethod[]).filter(m => m !== method).map((m) => {
                    const config = methodConfig[m];
                    const Icon = config.icon;
                    return (
                      <button
                        key={m}
                        onClick={() => setSplitMethod(m)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition",
                          splitMethod === m
                            ? config.activeColor
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={splitAmount}
                  readOnly
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                />
              </div>
              {Math.abs(totalPayment - payableAmount) > 0.01 && (
                <p className="text-xs text-amber-600">
                  Total ({formatCurrency(totalPayment)}) differs from payable amount ({formatCurrency(payableAmount)})
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
              />
            </div>
          )}

          {/* Summary */}
          {repayAmount > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Net Pay</span>
                <span className="font-medium">{formatCurrency(netPay)}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>Loan Repayment</span>
                <span className="font-medium">-{formatCurrency(repayAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1">
                <span>Employee Receives</span>
                <span>{formatCurrency(payableAmount)}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Banknote className="w-4 h-4" />
                Record Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
