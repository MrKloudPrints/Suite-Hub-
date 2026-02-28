"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Clock,
  DollarSign,
  Users,
  AlertTriangle,
  Loader2,
  Wallet,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
import { cn, formatCurrency, formatHours } from "@/lib/utils";
import type { DashboardStats } from "@/types";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

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

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  // Default to current week (Monday - Sunday)
  const [startDate, setStartDate] = useState(() =>
    formatDateISO(getMonday(new Date()))
  );
  const [endDate, setEndDate] = useState(() =>
    formatDateISO(addDays(getMonday(new Date()), 6))
  );

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(
        `/api/dashboard?startDate=${startDate}&endDate=${endDate}`
      );
      if (!res.ok) throw new Error("Failed to load dashboard data");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Quick-select handlers
  function selectThisWeek() {
    const monday = getMonday(new Date());
    setStartDate(formatDateISO(monday));
    setEndDate(formatDateISO(addDays(monday, 6)));
  }

  function selectThisMonth() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(formatDateISO(firstDay));
    setEndDate(formatDateISO(lastDay));
  }

  function selectPreviousWeek() {
    const current = new Date(startDate + "T00:00:00");
    const prevMonday = getMonday(addDays(current, -7));
    setStartDate(formatDateISO(prevMonday));
    setEndDate(formatDateISO(addDays(prevMonday, 6)));
  }

  function selectNextWeek() {
    const current = new Date(startDate + "T00:00:00");
    const nextMonday = getMonday(addDays(current, 7));
    setStartDate(formatDateISO(nextMonday));
    setEndDate(formatDateISO(addDays(nextMonday, 6)));
  }

  // ------------------------------------------------------------------
  // Loading / Error / Empty states
  // ------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {/* Keep date picker visible even on error so the user can adjust */}
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onThisWeek={selectThisWeek}
          onThisMonth={selectThisMonth}
          onPreviousWeek={selectPreviousWeek}
          onNextWeek={selectNextWeek}
        />
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl">
          {error}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // ------------------------------------------------------------------
  // Summary cards
  // ------------------------------------------------------------------

  const summaryCards = [
    {
      label: "Total Hours",
      value: formatHours(stats.totalHoursThisWeek),
      icon: Clock,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total Labor Cost",
      value: formatCurrency(stats.totalCostThisWeek),
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Active Employees",
      value: stats.activeEmployees.toString(),
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Overtime Hours",
      value: formatHours(stats.overtimeHoursThisWeek),
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Total Payouts",
      value: formatCurrency(stats.totalPayouts),
      icon: Wallet,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    ...(stats.missingPunches > 0
      ? [
          {
            label: "Missing Punches",
            value: stats.missingPunches.toString(),
            icon: AlertTriangle,
            color: "text-red-600",
            bg: "bg-red-50",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Payroll overview</p>
      </div>

      {/* Date Range Picker */}
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onThisWeek={selectThisWeek}
        onThisMonth={selectThisMonth}
        onPreviousWeek={selectPreviousWeek}
        onNextWeek={selectNextWeek}
      />

      {/* Missing punches alert */}
      {stats.missingPunches > 0 && (
        <Link href="/dashboard/timesheet">
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3 hover:bg-red-100 transition-colors cursor-pointer">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-red-800 font-semibold text-sm">
                {stats.missingPunches} Missing Punch
                {stats.missingPunches !== 1 ? "es" : ""} Detected
              </p>
              <p className="text-red-600 text-sm">
                Some employees have unpaired clock-in/out records. Click here to
                review the timesheet.
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {card.value}
                </p>
              </div>
              <div className={cn("p-3 rounded-xl", card.bg)}>
                <card.icon className={cn("w-6 h-6", card.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {stats.employeeHours.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Hours by Employee
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.employeeHours}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  label={{
                    value: "Hours",
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: "#64748b", fontSize: 12 },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "0.75rem",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value, name) => [
                    `${formatHours(Number(value))} hrs`,
                    name === "regular" ? "Regular" : "Overtime",
                  ]}
                />
                <Legend
                  formatter={(value) =>
                    value === "regular" ? "Regular Hours" : "Overtime Hours"
                  }
                />
                <Bar
                  dataKey="regular"
                  stackId="hours"
                  fill="#3b82f6"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="overtime"
                  stackId="hours"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {stats.employeeHours.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-slate-600 font-medium">No Data Yet</h3>
          <p className="text-slate-400 text-sm mt-1">
            Import time punch data to see hours breakdown.
          </p>
          <Link
            href="/dashboard/import"
            className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Go to Import
          </Link>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date Range Picker sub-component
// ---------------------------------------------------------------------------

function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onThisWeek,
  onThisMonth,
  onPreviousWeek,
  onNextWeek,
}: {
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onThisWeek: () => void;
  onThisMonth: () => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center gap-4">
      {/* Week arrows */}
      <button
        onClick={onPreviousWeek}
        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        title="Previous week"
      >
        <ChevronLeft className="w-5 h-5 text-slate-600" />
      </button>

      <div className="flex items-center gap-2 text-slate-600">
        <CalendarDays className="w-5 h-5" />
        <span className="text-sm font-medium">Date Range</span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          onClick={onThisWeek}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
        >
          This Week
        </button>

        <button
          onClick={onThisMonth}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
        >
          This Month
        </button>
      </div>

      <button
        onClick={onNextWeek}
        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        title="Next week"
      >
        <ChevronRight className="w-5 h-5 text-slate-600" />
      </button>
    </div>
  );
}
