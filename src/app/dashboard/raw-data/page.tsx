"use client";

import { useState, useEffect, useCallback } from "react";
import { Database, Loader2 } from "lucide-react";
import { formatTime } from "@/lib/utils";

interface Employee {
  id: string;
  code: string;
  name: string;
}

interface RawPunch {
  id: string;
  timestamp: string;
  type: string;
  source: string;
  rawLine: string | null;
  employee: { id: string; code: string; name: string };
}

interface GroupedPunches {
  employee: Employee;
  punches: RawPunch[];
}

export default function RawDataPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [punches, setPunches] = useState<RawPunch[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchPunches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterEmployee !== "all") params.set("employeeId", filterEmployee);
      if (filterStartDate) params.set("startDate", filterStartDate);
      if (filterEndDate) params.set("endDate", filterEndDate);

      const res = await fetch(`/api/punches?${params}`);
      if (res.ok) {
        const data: RawPunch[] = await res.json();
        // Only show imported punches — exclude manually entered
        setPunches(data.filter((p) => p.source !== "MANUAL"));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterEmployee, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchPunches();
  }, [fetchPunches]);

  // Group by employee, sorted by code
  const grouped: GroupedPunches[] = [];
  const empMap = new Map<string, RawPunch[]>();
  for (const p of punches) {
    const key = p.employee.id;
    if (!empMap.has(key)) empMap.set(key, []);
    empMap.get(key)!.push(p);
  }
  for (const [, punchList] of empMap) {
    grouped.push({
      employee: punchList[0].employee,
      punches: punchList.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    });
  }
  grouped.sort((a, b) => a.employee.code.localeCompare(b.employee.code));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Raw Data</h1>
        <p className="text-slate-500 mt-1">
          View imported punch data from .dat files (excludes manual entries)
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-5 py-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Employee</label>
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
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
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
        </div>
        {(filterEmployee !== "all" || filterStartDate || filterEndDate) && (
          <button
            onClick={() => {
              setFilterEmployee("all");
              setFilterStartDate("");
              setFilterEndDate("");
            }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-slate-600 font-medium">No Imported Data</h3>
          <p className="text-slate-400 text-sm mt-1">
            No imported punch records found for the selected filters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            {punches.length} imported record{punches.length !== 1 ? "s" : ""} across {grouped.length} employee{grouped.length !== 1 ? "s" : ""}
          </p>

          {grouped.map((group) => (
            <div
              key={group.employee.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
            >
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <Database className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <span className="font-semibold text-slate-900">
                    {group.employee.name || group.employee.code}
                  </span>
                  <span className="text-slate-400 text-sm ml-2">
                    ({group.employee.code})
                  </span>
                  <span className="text-slate-400 text-xs ml-3">
                    {group.punches.length} record{group.punches.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left text-xs font-medium text-slate-500 px-5 py-2.5">Date</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-5 py-2.5">Time</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-5 py-2.5">Raw Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.punches.map((punch) => {
                      const d = new Date(punch.timestamp);
                      return (
                        <tr key={punch.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                          <td className="px-5 py-2 text-sm text-slate-900">
                            {d.toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-5 py-2 text-sm text-slate-700">
                            {formatTime(punch.timestamp)}
                          </td>
                          <td className="px-5 py-2 text-xs font-mono text-slate-400">
                            {punch.rawLine || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
