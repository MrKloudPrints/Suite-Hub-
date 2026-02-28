"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DollarSign, Calculator, LogOut, Loader2 } from "lucide-react";

export default function ChoosePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
    // Employees auto-redirect to cash manager
    if (session?.user?.role === "EMPLOYEE") {
      router.push("/cash");
    }
  }, [session, status, router]);

  if (status === "loading" || session?.user?.role === "EMPLOYEE") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col">
      <div className="flex justify-between items-center px-8 py-6">
        <h1 className="text-white text-xl font-bold">Business Manager</h1>
        <div className="flex items-center gap-4">
          <span className="text-slate-300 text-sm">
            Welcome, {session?.user?.name}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl w-full">
          <button
            onClick={() => router.push("/dashboard")}
            className="group bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-10 text-left hover:bg-white/20 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 mb-6 group-hover:bg-blue-500/30 transition">
              <Calculator className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Payroll Manager
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Manage timesheets, employees, payouts, and generate paystubs.
            </p>
          </button>

          <button
            onClick={() => router.push("/cash")}
            className="group bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-10 text-left hover:bg-white/20 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 mb-6 group-hover:bg-emerald-500/30 transition">
              <DollarSign className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Cash Manager
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Track cash flow, expenses, register balances, and reconciliation.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
