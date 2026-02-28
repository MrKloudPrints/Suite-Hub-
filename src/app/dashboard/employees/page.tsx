"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Pencil,
  X,
  Save,
  Loader2,
  CheckCircle2,
  UserCircle,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { EmployeeWithStats } from "@/types";

interface EditForm {
  name: string;
  payRate: string;
  overtimeEnabled: boolean;
  overtimeThreshold: string;
  overtimeMultiplier: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    payRate: "",
    overtimeEnabled: false,
    overtimeThreshold: "40",
    overtimeMultiplier: "1.5",
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to load employees");
      const data = await res.json();
      setEmployees(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const startEdit = (emp: EmployeeWithStats) => {
    setEditingId(emp.id);
    setEditForm({
      name: emp.name,
      payRate: emp.payRate.toString(),
      overtimeEnabled: emp.overtimeEnabled,
      overtimeThreshold: emp.overtimeThreshold.toString(),
      overtimeMultiplier: emp.overtimeMultiplier.toString(),
    });
    setSaveSuccess(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      name: "",
      payRate: "",
      overtimeEnabled: false,
      overtimeThreshold: "40",
      overtimeMultiplier: "1.5",
    });
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          payRate: parseFloat(editForm.payRate),
          overtimeEnabled: editForm.overtimeEnabled,
          overtimeThreshold: parseFloat(editForm.overtimeThreshold),
          overtimeMultiplier: parseFloat(editForm.overtimeMultiplier),
        }),
      });

      if (!res.ok) throw new Error("Failed to update employee");

      await fetchEmployees();
      setEditingId(null);
      setSaveSuccess(id);
      setTimeout(() => setSaveSuccess(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
        <p className="text-slate-500 mt-1">
          Manage employee pay rates and overtime settings
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {employees.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-slate-600 font-medium">No Employees Yet</h3>
            <p className="text-slate-400 text-sm mt-1">
              Import attendance data to automatically create employee records.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Pay Rate
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    OT Enabled
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    OT Threshold
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr
                    key={emp.id}
                    className={cn(
                      "hover:bg-slate-50 transition-colors",
                      saveSuccess === emp.id && "bg-green-50"
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-2 text-sm font-mono text-slate-600">
                        <UserCircle className="w-4 h-4 text-slate-400" />
                        {emp.code}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-900">
                      {emp.name || (
                        <span className="text-slate-400 italic">
                          Not set
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-700">
                      {formatCurrency(emp.payRate)}
                      <span className="text-slate-400">/hr</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          emp.overtimeEnabled
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-500"
                        )}
                      >
                        {emp.overtimeEnabled ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-700">
                      {emp.overtimeThreshold}h
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          emp.active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        {emp.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {saveSuccess === emp.id ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          Saved
                        </span>
                      ) : (
                        <button
                          onClick={() => startEdit(emp)}
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                Edit Employee
              </h2>
              <button
                onClick={cancelEdit}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                  placeholder="Employee name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Pay Rate ($/hr)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.payRate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, payRate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                  placeholder="0.00"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Overtime Enabled
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setEditForm({
                      ...editForm,
                      overtimeEnabled: !editForm.overtimeEnabled,
                    })
                  }
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    editForm.overtimeEnabled ? "bg-blue-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      editForm.overtimeEnabled
                        ? "translate-x-6"
                        : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              {editForm.overtimeEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Overtime Threshold (hours/week)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={editForm.overtimeThreshold}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          overtimeThreshold: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Overtime Multiplier
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={editForm.overtimeMultiplier}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          overtimeMultiplier: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(editingId)}
                disabled={saving}
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
