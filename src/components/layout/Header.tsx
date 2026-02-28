"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { DollarSign, Monitor } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/timesheet": "Timesheet",
  "/dashboard/employees": "Employees",
  "/dashboard/import": "Import Data",
  "/dashboard/payouts": "Payouts",
  "/dashboard/paystubs": "Paystubs",
  "/dashboard/raw-data": "Raw Data",
  "/dashboard/settings": "Settings",
};

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const title = pageTitles[pathname] || "Dashboard";

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="flex items-center gap-2">
        {isAdmin && (
          <Link
            href="/cash"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
          >
            <DollarSign className="w-4 h-4" />
            Cash Manager
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
