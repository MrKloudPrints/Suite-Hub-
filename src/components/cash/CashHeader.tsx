"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Calculator, Monitor } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/cash": "Dashboard",
  "/cash/entries": "Cash Entries",
  "/cash/expenses": "Expenses",
  "/cash/reconciliation": "Reconciliation",
  "/cash/reports": "Reports",
};

export function CashHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const title = pageTitles[pathname] || "Cash Manager";

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="flex items-center gap-2">
        {isAdmin && (
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
          >
            <Calculator className="w-4 h-4" />
            Payroll
          </Link>
        )}
        <Link
          href="/register"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 transition"
        >
          <Monitor className="w-4 h-4" />
          POS Register
        </Link>
      </div>
    </header>
  );
}
