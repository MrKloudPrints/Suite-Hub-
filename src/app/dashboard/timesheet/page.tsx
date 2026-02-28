"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
  Save,
  CalendarPlus,
  Banknote,
} from "lucide-react";
import { cn, formatHours, formatTime, formatCurrency } from "@/lib/utils";
import { PaymentModal } from "@/components/PaymentModal";

interface Employee {
  id: string;
  code: string;
  name: string;
  payRate: number;
  overtimeEnabled: boolean;
  overtimeThreshold: number;
  overtimeMultiplier: number;
  active: boolean;
}

interface Punch {
  id: string;
  employeeId: string;
  timestamp: string;
  type: string;
  isManual: boolean;
}

interface PunchPair {
  clockIn: Punch;
  clockOut: Punch | null;
  hours: number;
}

interface DayData {
  date: string;
  dayLabel: string;
  punches: Punch[];
  pairs: PunchPair[];
  totalHours: number;
  hasIssue: boolean;
}

interface Payout {
  id: string;
  employeeId: string;
  amount: number;
  type: string;
  description: string;
  date: string;
}

interface EmployeeWeek {
  employee: Employee;
  days: DayData[];
  weekTotal: number;
  overtimeHours: number;
  regularHours: number;
  payouts: Payout[];
  totalPayouts: number;
  totalPay: number;
  netPay: number;
  totalPaid: number;
  balanceDue: number;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

function formatShortDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function pairPunches(punches: Punch[]): PunchPair[] {
  const sorted = [...punches].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const pairs: PunchPair[] = [];
  for (let i = 0; i < sorted.length; i += 2) {
    const clockIn = sorted[i];
    const clockOut = sorted[i + 1] ?? null;
    const hours = clockOut
      ? (new Date(clockOut.timestamp).getTime() -
          new Date(clockIn.timestamp).getTime()) /
        3600000
      : 0;
    pairs.push({ clockIn, clockOut, hours });
  }
  return pairs;
}

export default function TimesheetPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Expanded cell state
  const [expandedCell, setExpandedCell] = useState<string | null>(null);

  // Add punch modal state
  const [addPunchModal, setAddPunchModal] = useState<{
    employeeId: string;
    date: string;
  } | null>(null);
  const [addPunchTime, setAddPunchTime] = useState("");
  const [addPunchType, setAddPunchType] = useState<"IN" | "OUT">("IN");
  const [addingPunch, setAddingPunch] = useState(false);

  // Add full shift modal state
  const [addShiftModal, setAddShiftModal] = useState<{
    employeeId: string;
    date: string;
  } | null>(null);
  const [shiftInTime, setShiftInTime] = useState("09:00");
  const [shiftOutTime, setShiftOutTime] = useState("17:00");
  const [addingShift, setAddingShift] = useState(false);

  // Edit punch modal state
  const [editPunchModal, setEditPunchModal] = useState<Punch | null>(null);
  const [editPunchTime, setEditPunchTime] = useState("");
  const [editingPunch, setEditingPunch] = useState(false);

  const [deletingPunch, setDeletingPunch] = useState<string | null>(null);

  // Payment modal state
  const [paymentTarget, setPaymentTarget] = useState<{
    employeeId: string;
    employeeName: string;
    netPay: number;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const startDate = formatDateISO(weekStart);
      const endDate = formatDateISO(addDays(weekStart, 6));

      const [empRes, punchRes, payoutRes] = await Promise.all([
        fetch("/api/employees"),
        fetch(`/api/punches?startDate=${startDate}&endDate=${endDate}`),
        fetch(`/api/payouts?startDate=${startDate}&endDate=${endDate}`),
      ]);

      if (!empRes.ok) throw new Error("Failed to load employees");
      if (!punchRes.ok) throw new Error("Failed to load punches");
      if (!payoutRes.ok) throw new Error("Failed to load payouts");

      const empData = await empRes.json();
      const punchData = await punchRes.json();
      const payoutData = await payoutRes.json();

      setEmployees(empData);
      setPunches(punchData);
      setPayouts(payoutData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const goToPreviousWeek = () => setWeekStart(addDays(weekStart, -7));
  const goToNextWeek = () => setWeekStart(addDays(weekStart, 7));
  const goToCurrentWeek = () => setWeekStart(getMonday(new Date()));

  // Build weekly data per employee (only those with punches this week)
  const employeeWeeks: EmployeeWeek[] = employees
    .filter((e) => e.active)
    .filter((e) => punches.some((p) => p.employeeId === e.id))
    .map((emp) => {
      const empPunches = punches.filter((p) => p.employeeId === emp.id);
      const days: DayData[] = [];

      for (let i = 0; i < 7; i++) {
        const dayDate = addDays(weekStart, i);
        const dateStr = formatDateISO(dayDate);
        const dayPunches = empPunches.filter((p) => {
          const pDate = new Date(p.timestamp);
          return formatDateISO(pDate) === dateStr;
        });

        const pairs = pairPunches(dayPunches);
        const totalHours = pairs.reduce((sum, p) => sum + p.hours, 0);
        const hasIssue = dayPunches.length % 2 !== 0;

        days.push({
          date: dateStr,
          dayLabel: DAY_LABELS[i],
          punches: dayPunches,
          pairs,
          totalHours,
          hasIssue,
        });
      }

      const weekTotal = days.reduce((sum, d) => sum + d.totalHours, 0);
      let regularHours: number;
      let overtimeHours: number;

      if (emp.overtimeEnabled && weekTotal > emp.overtimeThreshold) {
        regularHours = emp.overtimeThreshold;
        overtimeHours = weekTotal - emp.overtimeThreshold;
      } else {
        regularHours = weekTotal;
        overtimeHours = 0;
      }

      const empPayouts = payouts.filter((p) => p.employeeId === emp.id);
      const totalPayouts = empPayouts
        .filter((p) => p.type !== "PAYMENT" && p.type !== "LOAN_REPAYMENT")
        .reduce((sum, p) => sum + p.amount, 0);

      const regularPay = regularHours * emp.payRate;
      const overtimePay = overtimeHours * emp.payRate * emp.overtimeMultiplier;
      const totalPay = Math.round((regularPay + overtimePay) * 100) / 100;
      const netPay = Math.round((totalPay - totalPayouts) * 100) / 100;
      const totalPaid = empPayouts
        .filter((p) => p.type === "PAYMENT")
        .reduce((sum, p) => sum + p.amount, 0);
      const balanceDue = Math.max(0, Math.round((netPay - totalPaid) * 100) / 100);

      return { employee: emp, days, weekTotal, regularHours, overtimeHours, payouts: empPayouts, totalPayouts, totalPay, netPay, totalPaid, balanceDue };
    });

  const totalMissingPunches = employeeWeeks.reduce(
    (sum, ew) => sum + ew.days.filter((d) => d.hasIssue).length,
    0
  );

  // Handle add punch
  const handleAddPunch = async () => {
    if (!addPunchModal || !addPunchTime) return;
    setAddingPunch(true);
    try {
      const timestamp = new Date(
        `${addPunchModal.date}T${addPunchTime}:00`
      ).toISOString();
      const res = await fetch("/api/punches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: addPunchModal.employeeId,
          timestamp,
          type: addPunchType,
          isManual: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add punch");
      }
      setAddPunchModal(null);
      setAddPunchTime("");
      setAddPunchType("IN");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add punch");
    } finally {
      setAddingPunch(false);
    }
  };

  // Handle add full shift (supports overnight: if out <= in, out rolls to next day)
  const handleAddShift = async () => {
    if (!addShiftModal || !shiftInTime || !shiftOutTime) return;
    setAddingShift(true);
    try {
      const inTimestamp = new Date(
        `${addShiftModal.date}T${shiftInTime}:00`
      ).toISOString();

      // If clock-out time is <= clock-in time, it's an overnight shift → next day
      let outDate = addShiftModal.date;
      if (shiftOutTime <= shiftInTime) {
        const nextDay = new Date(addShiftModal.date + "T12:00:00");
        nextDay.setDate(nextDay.getDate() + 1);
        outDate = formatDateISO(nextDay);
      }
      const outTimestamp = new Date(
        `${outDate}T${shiftOutTime}:00`
      ).toISOString();

      // Send clock-in first, then clock-out (sequential to avoid double-punch filter)
      const res1 = await fetch("/api/punches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: addShiftModal.employeeId,
          timestamp: inTimestamp,
          isManual: true,
        }),
      });
      if (!res1.ok) {
        const data = await res1.json();
        throw new Error(data.error || "Failed to add clock-in");
      }

      const res2 = await fetch("/api/punches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: addShiftModal.employeeId,
          timestamp: outTimestamp,
          isManual: true,
        }),
      });
      if (!res2.ok) {
        const data = await res2.json();
        throw new Error(data.error || "Failed to add clock-out");
      }

      setAddShiftModal(null);
      setShiftInTime("09:00");
      setShiftOutTime("17:00");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add shift");
    } finally {
      setAddingShift(false);
    }
  };

  // Handle edit punch
  const handleEditPunch = async () => {
    if (!editPunchModal || !editPunchTime) return;
    setEditingPunch(true);
    try {
      const dateStr = editPunchModal.timestamp.split("T")[0];
      const timestamp = new Date(
        `${dateStr}T${editPunchTime}:00`
      ).toISOString();
      const res = await fetch(`/api/punches/${editPunchModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp }),
      });
      if (!res.ok) throw new Error("Failed to update punch");
      setEditPunchModal(null);
      setEditPunchTime("");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update punch");
    } finally {
      setEditingPunch(false);
    }
  };

  // Handle delete punch
  const handleDeletePunch = async (punchId: string) => {
    setDeletingPunch(punchId);
    try {
      const res = await fetch(`/api/punches/${punchId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete punch");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete punch");
    } finally {
      setDeletingPunch(null);
    }
  };

  const openEditPunch = (punch: Punch) => {
    const d = new Date(punch.timestamp);
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    setEditPunchTime(`${hours}:${minutes}`);
    setEditPunchModal(punch);
  };

  const toggleCell = (key: string) => {
    setExpandedCell(expandedCell === key ? null : key);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Timesheet</h1>
          <p className="text-slate-500 mt-1">
            Review and manage employee time punches
          </p>
        </div>
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {totalMissingPunches > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700 text-sm font-medium">
            {totalMissingPunches} day{totalMissingPunches !== 1 ? "s" : ""} with
            missing punches detected. Cells highlighted in red need attention.
          </p>
        </div>
      )}

      {/* Timesheet Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 z-10 min-w-[140px]">
                  Employee
                </th>
                {Array.from({ length: 7 }).map((_, i) => {
                  const dayDate = addDays(weekStart, i);
                  return (
                    <th
                      key={i}
                      className="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[110px]"
                    >
                      <div>{DAY_LABELS[i]}</div>
                      <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                        {formatShortDay(formatDateISO(dayDate))}
                      </div>
                    </th>
                  );
                })}
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[70px]">
                  Total
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[60px]">
                  OT
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[90px]">
                  Pay
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[90px]">
                  Payouts
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[70px]">
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employeeWeeks.length === 0 ? (
                <tr>
                  <td
                    colSpan={13}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p>No active employees found.</p>
                  </td>
                </tr>
              ) : (
                employeeWeeks.map((ew) => (
                  <tr key={ew.employee.id} className="group">
                    <td className="px-4 py-3 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100">
                      <p className="text-sm font-medium text-slate-900">
                        {ew.employee.name || ew.employee.code}
                      </p>
                      <p className="text-xs text-slate-400">
                        {ew.employee.code}
                      </p>
                    </td>
                    {ew.days.map((day) => {
                      const cellKey = `${ew.employee.id}-${day.date}`;
                      const isExpanded = expandedCell === cellKey;

                      return (
                        <td
                          key={day.date}
                          className={cn(
                            "px-1 py-1 text-center align-top relative",
                            day.hasIssue && "bg-red-50"
                          )}
                        >
                          {/* Compact Cell View */}
                          <div
                            onClick={() => toggleCell(cellKey)}
                            className={cn(
                              "cursor-pointer rounded-lg px-2 py-2 min-h-[52px] flex flex-col items-center justify-center transition-colors",
                              day.hasIssue
                                ? "border border-red-300 bg-red-50 hover:bg-red-100"
                                : day.punches.length > 0
                                  ? "hover:bg-slate-100"
                                  : "hover:bg-slate-50"
                            )}
                          >
                            {day.punches.length > 0 ? (
                              <>
                                {day.pairs.map((pair, pi) => (
                                  <div
                                    key={pi}
                                    className="text-[11px] text-slate-600 leading-tight"
                                  >
                                    {formatTime(pair.clockIn.timestamp)}
                                    {pair.clockOut && (
                                      <>
                                        {" - "}
                                        {formatTime(pair.clockOut.timestamp)}
                                      </>
                                    )}
                                    {!pair.clockOut && (
                                      <span className="text-red-500 ml-1">
                                        ?
                                      </span>
                                    )}
                                  </div>
                                ))}
                                <div
                                  className={cn(
                                    "text-xs font-semibold mt-1",
                                    day.hasIssue
                                      ? "text-red-600"
                                      : "text-slate-900"
                                  )}
                                >
                                  {formatHours(day.totalHours)}h
                                </div>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-300">
                                --
                              </span>
                            )}
                          </div>

                          {/* Expanded Cell */}
                          {isExpanded && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 z-30 bg-white rounded-xl shadow-lg border border-slate-200 p-3 min-w-[240px] text-left mt-1">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-slate-700">
                                  {day.dayLabel},{" "}
                                  {formatShortDay(day.date)}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedCell(null);
                                  }}
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Existing punches */}
                              {day.punches.length > 0 && (
                                <div className="space-y-1.5 mb-3">
                                  {day.punches
                                    .sort(
                                      (a, b) =>
                                        new Date(a.timestamp).getTime() -
                                        new Date(b.timestamp).getTime()
                                    )
                                    .map((punch, idx) => {
                                      // Use explicit type if set, otherwise fall back to positional
                                      const punchLabel = punch.type === "IN" || punch.type === "OUT"
                                        ? punch.type
                                        : idx % 2 === 0 ? "IN" : "OUT";
                                      return (
                                      <div
                                        key={punch.id}
                                        className="flex items-center justify-between bg-slate-50 rounded-lg px-2.5 py-1.5"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={cn(
                                              "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                              punchLabel === "IN"
                                                ? "bg-green-100 text-green-700"
                                                : "bg-blue-100 text-blue-700"
                                            )}
                                          >
                                            {punchLabel}
                                          </span>
                                          <span className="text-xs text-slate-700">
                                            {formatTime(punch.timestamp)}
                                          </span>
                                          {punch.isManual && (
                                            <span className="text-[9px] text-amber-600 bg-amber-50 px-1 rounded">
                                              Manual
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openEditPunch(punch);
                                            }}
                                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeletePunch(punch.id);
                                            }}
                                            disabled={
                                              deletingPunch === punch.id
                                            }
                                            className="p-1 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                          >
                                            {deletingPunch === punch.id ? (
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <Trash2 className="w-3 h-3" />
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                      );
                                    })}
                                </div>
                              )}

                              {/* Action buttons */}
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAddPunchModal({
                                      employeeId: ew.employee.id,
                                      date: day.date,
                                    });
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded-lg transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add Punch
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAddShiftModal({
                                      employeeId: ew.employee.id,
                                      date: day.date,
                                    });
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 px-2 py-1.5 rounded-lg transition-colors"
                                >
                                  <CalendarPlus className="w-3 h-3" />
                                  Full Shift
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm font-bold text-slate-900">
                        {formatHours(ew.weekTotal)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {ew.overtimeHours > 0 ? (
                        <span className="text-sm font-bold text-amber-600">
                          {formatHours(ew.overtimeHours)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-300">--</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm font-bold text-green-600">
                        {formatCurrency(ew.totalPay)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {ew.totalPayouts > 0 ? (
                        <div className="group/payout relative">
                          <span className="text-sm font-bold text-red-600 cursor-help">
                            {formatCurrency(ew.totalPayouts)}
                          </span>
                          <div className="hidden group-hover/payout:block absolute right-0 top-full z-30 bg-white rounded-xl shadow-lg border border-slate-200 p-3 min-w-[200px] text-left mt-1">
                            <p className="text-xs font-semibold text-slate-700 mb-2">Payouts This Week</p>
                            <div className="space-y-1.5">
                              {ew.payouts.map((p) => (
                                <div key={p.id} className="flex items-center justify-between text-xs">
                                  <div>
                                    <span className={cn(
                                      "font-medium px-1.5 py-0.5 rounded mr-1.5",
                                      p.type === "ADVANCE" ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700"
                                    )}>
                                      {p.type}
                                    </span>
                                    <span className="text-slate-600">{p.description || "No description"}</span>
                                  </div>
                                  <span className="text-slate-900 font-semibold ml-2">{formatCurrency(p.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-300">--</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {ew.totalPay > 0 && (
                        ew.balanceDue <= 0 && ew.totalPaid > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-600 text-xs font-medium rounded-lg border border-green-200">
                            <Banknote className="w-3.5 h-3.5" />
                            Paid
                          </span>
                        ) : (
                          <button
                            onClick={() => setPaymentTarget({
                              employeeId: ew.employee.id,
                              employeeName: ew.employee.name || ew.employee.code,
                              netPay: ew.balanceDue,
                            })}
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition",
                              ew.totalPaid > 0
                                ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            )}
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            {ew.totalPaid > 0
                              ? `${formatCurrency(ew.balanceDue)} due`
                              : "Pay"}
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Punch Modal */}
      {addPunchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Add Punch</h3>
              <button
                onClick={() => setAddPunchModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Punch Type Toggle */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Punch Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAddPunchType("IN")}
                    className={cn(
                      "flex-1 px-3 py-2 text-sm font-semibold rounded-lg border transition",
                      addPunchType === "IN"
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    Clock In
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddPunchType("OUT")}
                    className={cn(
                      "flex-1 px-3 py-2 text-sm font-semibold rounded-lg border transition",
                      addPunchType === "OUT"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    Clock Out
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date
                </label>
                <input
                  type="text"
                  value={addPunchModal.date}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={addPunchTime}
                  onChange={(e) => setAddPunchTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setAddPunchModal(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPunch}
                disabled={!addPunchTime || addingPunch}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed",
                  addPunchType === "IN"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {addingPunch ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Add {addPunchType === "IN" ? "Clock In" : "Clock Out"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Full Shift Modal */}
      {addShiftModal && (() => {
        const isOvernight = shiftOutTime <= shiftInTime && shiftOutTime !== "" && shiftInTime !== "";
        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Add Full Shift</h3>
              <button
                onClick={() => setAddShiftModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date
                </label>
                <input
                  type="text"
                  value={addShiftModal.date}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Clock In
                </label>
                <input
                  type="time"
                  value={shiftInTime}
                  onChange={(e) => setShiftInTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Clock Out
                </label>
                <input
                  type="time"
                  value={shiftOutTime}
                  onChange={(e) => setShiftOutTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                />
              </div>
              {isOvernight && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700">
                    Overnight shift detected — clock out will be on the next day ({(() => {
                      const nextDay = new Date(addShiftModal.date + "T12:00:00");
                      nextDay.setDate(nextDay.getDate() + 1);
                      return formatShortDay(formatDateISO(nextDay));
                    })()})
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setAddShiftModal(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleAddShift}
                disabled={!shiftInTime || !shiftOutTime || addingShift}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingShift ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CalendarPlus className="w-4 h-4" />
                )}
                Add Shift
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Payment Modal */}
      {paymentTarget && (
        <PaymentModal
          employeeId={paymentTarget.employeeId}
          employeeName={paymentTarget.employeeName}
          netPay={paymentTarget.netPay}
          date={formatDateISO(new Date())}
          onClose={() => setPaymentTarget(null)}
          onSuccess={() => fetchData()}
        />
      )}

      {/* Edit Punch Modal */}
      {editPunchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Edit Punch</h3>
              <button
                onClick={() => setEditPunchModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date
                </label>
                <input
                  type="text"
                  value={editPunchModal.timestamp.split("T")[0]}
                  disabled
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={editPunchTime}
                  onChange={(e) => setEditPunchTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setEditPunchModal(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleEditPunch}
                disabled={!editPunchTime || editingPunch}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingPunch ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
