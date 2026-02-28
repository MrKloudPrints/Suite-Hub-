"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  Loader2,
  Clock,
  DollarSign,
  Wallet,
  Banknote,
} from "lucide-react";
import { cn, formatCurrency, formatHours, formatTime } from "@/lib/utils";
import type { PaystubData } from "@/types";
import { PaymentModal } from "@/components/PaymentModal";

interface Employee {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  };
  const endOpts: Intl.DateTimeFormatOptions = {
    ...opts,
    year: "numeric",
  };
  return `${monday.toLocaleDateString("en-US", opts)} - ${sunday.toLocaleDateString("en-US", endOpts)}`;
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function PaystubsPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [paystubs, setPaystubs] = useState<PaystubData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [error, setError] = useState("");

  // Payment modal state
  const [paymentTarget, setPaymentTarget] = useState<{
    employeeId: string;
    employeeName: string;
    netPay: number;
  } | null>(null);

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

  const fetchPaystubs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const weekStartStr = formatDateISO(weekStart);
      const params = new URLSearchParams({ weekStart: weekStartStr });
      if (selectedEmployeeId !== "all") {
        params.set("employeeId", selectedEmployeeId);
      }

      const res = await fetch(`/api/paystubs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load paystubs");
      const data = await res.json();
      setPaystubs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [weekStart, selectedEmployeeId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchPaystubs();
  }, [fetchPaystubs]);

  const goToPreviousWeek = () => setWeekStart(addDays(weekStart, -7));
  const goToNextWeek = () => setWeekStart(addDays(weekStart, 7));
  const goToCurrentWeek = () => setWeekStart(getMonday(new Date()));

  const generatePdf = async (paystub: PaystubData) => {
    setGeneratingPdf(paystub.employee.code);
    try {
      const { pdf, Document, Page, Text, View, StyleSheet } = await import(
        "@react-pdf/renderer"
      );

      const styles = StyleSheet.create({
        page: {
          padding: 40,
          fontSize: 10,
          fontFamily: "Helvetica",
          color: "#1e293b",
        },
        header: {
          marginBottom: 20,
          borderBottom: "2px solid #3b82f6",
          paddingBottom: 12,
        },
        title: {
          fontSize: 20,
          fontFamily: "Helvetica-Bold",
          color: "#1e293b",
          marginBottom: 4,
        },
        subtitle: {
          fontSize: 11,
          color: "#64748b",
        },
        section: {
          marginBottom: 16,
        },
        sectionTitle: {
          fontSize: 12,
          fontFamily: "Helvetica-Bold",
          color: "#1e293b",
          marginBottom: 8,
          backgroundColor: "#f1f5f9",
          padding: 6,
        },
        row: {
          flexDirection: "row",
          paddingVertical: 4,
          borderBottom: "1px solid #e2e8f0",
        },
        headerRow: {
          flexDirection: "row",
          paddingVertical: 4,
          borderBottom: "2px solid #cbd5e1",
          backgroundColor: "#f8fafc",
        },
        cell: {
          flex: 1,
          paddingHorizontal: 4,
        },
        cellRight: {
          flex: 1,
          paddingHorizontal: 4,
          textAlign: "right",
        },
        bold: {
          fontFamily: "Helvetica-Bold",
        },
        empInfo: {
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 16,
        },
        empBlock: {
          flex: 1,
        },
        label: {
          fontSize: 9,
          color: "#94a3b8",
          marginBottom: 2,
        },
        value: {
          fontSize: 11,
          fontFamily: "Helvetica-Bold",
        },
        summaryRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          paddingVertical: 3,
        },
        totalRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          paddingVertical: 6,
          borderTop: "2px solid #1e293b",
          marginTop: 4,
        },
        totalLabel: {
          fontSize: 13,
          fontFamily: "Helvetica-Bold",
        },
        totalValue: {
          fontSize: 13,
          fontFamily: "Helvetica-Bold",
          color: "#16a34a",
        },
        deductionText: {
          color: "#dc2626",
        },
        badge: {
          fontSize: 8,
          backgroundColor: "#f1f5f9",
          paddingHorizontal: 4,
          paddingVertical: 2,
          borderRadius: 3,
          color: "#475569",
        },
      });

      const doc = (
        <Document>
          <Page size="A4" style={styles.page}>
            <View style={styles.header}>
              <Text style={styles.title}>Pay Stub</Text>
              <Text style={styles.subtitle}>{paystub.period.label}</Text>
            </View>

            <View style={styles.empInfo}>
              <View style={styles.empBlock}>
                <Text style={styles.label}>EMPLOYEE NAME</Text>
                <Text style={styles.value}>
                  {paystub.employee.name || paystub.employee.code}
                </Text>
              </View>
              <View style={styles.empBlock}>
                <Text style={styles.label}>EMPLOYEE CODE</Text>
                <Text style={styles.value}>{paystub.employee.code}</Text>
              </View>
              <View style={styles.empBlock}>
                <Text style={styles.label}>PAY RATE</Text>
                <Text style={styles.value}>
                  ${paystub.employee.payRate.toFixed(2)}/hr
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Daily Breakdown</Text>
              <View style={styles.headerRow}>
                <Text style={[styles.cell, styles.bold]}>Date</Text>
                <Text style={[styles.cell, styles.bold]}>Day</Text>
                <Text style={[styles.cell, styles.bold]}>Clock In/Out</Text>
                <Text style={[styles.cellRight, styles.bold]}>Hours</Text>
              </View>
              {paystub.dailyBreakdown.map((day, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.cell}>{day.date}</Text>
                  <Text style={styles.cell}>{day.dayOfWeek}</Text>
                  <Text style={styles.cell}>
                    {day.pairs.length > 0
                      ? day.pairs
                          .map(
                            (p) =>
                              `${formatTime(p.clockIn)} - ${p.clockOut ? formatTime(p.clockOut) : "?"}`
                          )
                          .join(", ")
                      : "--"}
                  </Text>
                  <Text style={styles.cellRight}>
                    {day.dayTotal > 0 ? day.dayTotal.toFixed(2) : "--"}
                  </Text>
                </View>
              ))}
            </View>

            {paystub.payouts.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payouts / Deductions</Text>
                <View style={styles.headerRow}>
                  <Text style={[styles.cell, styles.bold]}>Date</Text>
                  <Text style={[styles.cell, styles.bold]}>Type</Text>
                  <Text style={[styles.cell, styles.bold]}>Description</Text>
                  <Text style={[styles.cellRight, styles.bold]}>Amount</Text>
                </View>
                {paystub.payouts.map((payout, i) => (
                  <View key={i} style={styles.row}>
                    <Text style={styles.cell}>{payout.date}</Text>
                    <Text style={styles.cell}>
                      <Text style={styles.badge}>{payout.type}</Text>
                    </Text>
                    <Text style={styles.cell}>{payout.description}</Text>
                    <Text style={[styles.cellRight, styles.deductionText]}>
                      -${payout.amount.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pay Summary</Text>
              <View style={styles.summaryRow}>
                <Text>Regular Hours</Text>
                <Text>{paystub.summary.regularHours.toFixed(2)}</Text>
              </View>
              {paystub.summary.overtimeHours > 0 && (
                <View style={styles.summaryRow}>
                  <Text>Overtime Hours</Text>
                  <Text>{paystub.summary.overtimeHours.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text>
                  Regular Pay ({paystub.summary.regularHours.toFixed(2)} hrs x $
                  {paystub.summary.payRate.toFixed(2)})
                </Text>
                <Text>${paystub.summary.regularPay.toFixed(2)}</Text>
              </View>
              {paystub.summary.overtimePay > 0 && (
                <View style={styles.summaryRow}>
                  <Text>
                    Overtime Pay ({paystub.summary.overtimeHours.toFixed(2)} hrs
                    x ${paystub.summary.overtimeRate.toFixed(2)})
                  </Text>
                  <Text>${paystub.summary.overtimePay.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.bold}>Gross Pay</Text>
                <Text style={styles.bold}>
                  ${paystub.summary.grossPay.toFixed(2)}
                </Text>
              </View>
              {paystub.summary.totalPayouts > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.deductionText}>Total Deductions</Text>
                  <Text style={styles.deductionText}>
                    -${paystub.summary.totalPayouts.toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Net Pay</Text>
                <Text style={styles.totalValue}>
                  ${paystub.summary.netPay.toFixed(2)}
                </Text>
              </View>
              {paystub.summary.totalPaid > 0 && (
                <View style={styles.summaryRow}>
                  <Text>Paid</Text>
                  <Text>${paystub.summary.totalPaid.toFixed(2)}</Text>
                </View>
              )}
              {paystub.summary.balanceDue > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.deductionText}>Balance Due</Text>
                  <Text style={styles.deductionText}>
                    ${paystub.summary.balanceDue.toFixed(2)}
                  </Text>
                </View>
              )}
              {paystub.summary.priorBalance > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.deductionText}>Prior Weeks Owed</Text>
                  <Text style={styles.deductionText}>
                    ${paystub.summary.priorBalance.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          </Page>
        </Document>
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `paystub-${paystub.employee.code}-${formatDateISO(weekStart)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate PDF"
      );
    } finally {
      setGeneratingPdf(null);
    }
  };

  const generateAllPdfs = async () => {
    setGeneratingAll(true);
    try {
      for (const paystub of paystubs) {
        await generatePdf(paystub);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate PDFs"
      );
    } finally {
      setGeneratingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Paystubs</h1>
          <p className="text-slate-500 mt-1">
            Generate and download employee pay stubs
          </p>
        </div>
        {paystubs.length > 1 && (
          <button
            onClick={generateAllPdfs}
            disabled={generatingAll}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingAll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download All PDFs
              </>
            )}
          </button>
        )}
      </div>

      {/* Week Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-5 py-3 flex items-center justify-between">
        <button
          onClick={goToPreviousWeek}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-slate-900">
            {formatWeekRange(weekStart)}
          </span>
          <button
            onClick={goToCurrentWeek}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            Today
          </button>
        </div>
        <button
          onClick={goToNextWeek}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Employee Selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Employee:</label>
        <select
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(e.target.value)}
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : paystubs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-slate-600 font-medium">No Paystub Data</h3>
          <p className="text-slate-400 text-sm mt-1">
            No time punch data found for this week.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {paystubs.map((paystub) => (
            <div
              key={paystub.employee.code}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {paystub.employee.name || paystub.employee.code}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Code: {paystub.employee.code} &middot; Rate:{" "}
                    {formatCurrency(paystub.employee.payRate)}/hr &middot;{" "}
                    {paystub.period.label}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {paystub.summary.balanceDue <= 0 && paystub.summary.totalPaid > 0 ? (
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 text-sm font-medium rounded-lg border border-green-200">
                      <Banknote className="w-4 h-4" />
                      Paid {formatCurrency(paystub.summary.totalPaid)}
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        const emp = employees.find(e => e.code === paystub.employee.code);
                        if (emp) {
                          const remaining = paystub.summary.balanceDue + paystub.summary.priorBalance;
                          setPaymentTarget({
                            employeeId: emp.id,
                            employeeName: paystub.employee.name || paystub.employee.code,
                            netPay: remaining,
                          });
                        }
                      }}
                      className={cn(
                        "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition",
                        paystub.summary.totalPaid > 0
                          ? "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                          : "bg-green-600 text-white hover:bg-green-700"
                      )}
                    >
                      <Banknote className="w-4 h-4" />
                      {paystub.summary.totalPaid > 0
                        ? `Partial — ${formatCurrency(paystub.summary.balanceDue)} due`
                        : "Pay"}
                    </button>
                  )}
                  <button
                    onClick={() => generatePdf(paystub)}
                    disabled={generatingPdf === paystub.employee.code}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingPdf === paystub.employee.code ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download PDF
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Daily Breakdown Table */}
              <div className="px-6 py-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Daily Breakdown
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                          Date
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                          Day
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                          Clock In / Out
                        </th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                          Hours
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paystub.dailyBreakdown.map((day, i) => (
                        <tr
                          key={i}
                          className={cn(
                            day.dayTotal > 0
                              ? "text-slate-700"
                              : "text-slate-400"
                          )}
                        >
                          <td className="py-2 px-3">{day.date}</td>
                          <td className="py-2 px-3">{day.dayOfWeek}</td>
                          <td className="py-2 px-3">
                            {day.pairs.length > 0
                              ? day.pairs
                                  .map(
                                    (p) =>
                                      `${formatTime(p.clockIn)} - ${p.clockOut ? formatTime(p.clockOut) : "?"}`
                                  )
                                  .join(", ")
                              : "--"}
                          </td>
                          <td className="py-2 px-3 text-right font-medium">
                            {day.dayTotal > 0
                              ? formatHours(day.dayTotal)
                              : "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payouts / Deductions */}
              {paystub.payouts.length > 0 && (
                <div className="px-6 py-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Payouts / Deductions
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                            Date
                          </th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                            Type
                          </th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                            Description
                          </th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paystub.payouts.map((payout, i) => (
                          <tr key={i} className="text-slate-700">
                            <td className="py-2 px-3">{payout.date}</td>
                            <td className="py-2 px-3">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                                  payout.type === "ADVANCE"
                                    ? "bg-amber-100 text-amber-700"
                                    : payout.type === "LOAN_REPAYMENT"
                                      ? "bg-orange-100 text-orange-700"
                                      : payout.type === "PAYMENT"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-purple-100 text-purple-700"
                                )}
                              >
                                {payout.type === "LOAN_REPAYMENT" ? "Loan Repayment" : payout.type}
                              </span>
                            </td>
                            <td className="py-2 px-3">{payout.description}</td>
                            <td className="py-2 px-3 text-right font-medium text-red-600">
                              -{formatCurrency(payout.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pay Summary */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Pay Summary
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Regular Hours</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatHours(paystub.summary.regularHours)}
                    </p>
                  </div>
                  {paystub.summary.overtimeHours > 0 && (
                    <div>
                      <p className="text-xs text-slate-500">Overtime Hours</p>
                      <p className="text-lg font-bold text-amber-600">
                        {formatHours(paystub.summary.overtimeHours)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-500">Regular Pay</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(paystub.summary.regularPay)}
                    </p>
                  </div>
                  {paystub.summary.overtimePay > 0 && (
                    <div>
                      <p className="text-xs text-slate-500">
                        Overtime Pay (
                        {paystub.summary.overtimeMultiplier}x)
                      </p>
                      <p className="text-lg font-bold text-amber-600">
                        {formatCurrency(paystub.summary.overtimePay)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-500">Gross Pay</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(paystub.summary.grossPay)}
                    </p>
                  </div>
                  {paystub.summary.totalPayouts > 0 && (
                    <div>
                      <p className="text-xs text-slate-500">Total Deductions</p>
                      <p className="text-lg font-bold text-red-600">
                        -{formatCurrency(paystub.summary.totalPayouts)}
                      </p>
                    </div>
                  )}
                  <div className="col-span-2 md:col-span-1">
                    <p className="text-xs text-slate-500">Net Pay</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(paystub.summary.netPay)}
                    </p>
                  </div>
                  {paystub.summary.totalPaid > 0 && (
                    <div>
                      <p className="text-xs text-slate-500">Paid</p>
                      <p className="text-lg font-bold text-emerald-600">
                        {formatCurrency(paystub.summary.totalPaid)}
                      </p>
                    </div>
                  )}
                  {paystub.summary.balanceDue > 0 && (
                    <div>
                      <p className="text-xs text-slate-500">Balance Due</p>
                      <p className="text-lg font-bold text-red-600">
                        {formatCurrency(paystub.summary.balanceDue)}
                      </p>
                    </div>
                  )}
                  {paystub.summary.priorBalance > 0 && (
                    <div>
                      <p className="text-xs text-slate-500">Prior Weeks Owed</p>
                      <p className="text-lg font-bold text-amber-600">
                        {formatCurrency(paystub.summary.priorBalance)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment Modal */}
      {paymentTarget && (
        <PaymentModal
          employeeId={paymentTarget.employeeId}
          employeeName={paymentTarget.employeeName}
          netPay={paymentTarget.netPay}
          date={formatDateISO(weekStart)}
          onClose={() => setPaymentTarget(null)}
          onSuccess={() => fetchPaystubs()}
        />
      )}
    </div>
  );
}
