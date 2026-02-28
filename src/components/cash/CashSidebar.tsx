"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Banknote,
  Receipt,
  Scale,
  BarChart3,
  FileText,
  LogOut,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function CashSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const navItems = [
    ...(isAdmin ? [{ href: "/cash", label: "Dashboard", icon: LayoutDashboard }] : []),
    { href: "/cash/entries", label: "Cash Entries", icon: Banknote },
    { href: "/cash/expenses", label: "Expenses", icon: Receipt },
    ...(isAdmin
      ? [
          { href: "/cash/reconciliation", label: "Reconciliation", icon: Scale },
          { href: "/cash/reports", label: "Reports", icon: BarChart3 },
        ]
      : []),
    { href: "/cash/sales-report", label: "Sales Report", icon: FileText },
  ];

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col min-h-screen">
      <div className="p-6">
        <h1 className="text-xl font-bold">Cash Manager</h1>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/cash" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10 space-y-1">
        {isAdmin && (
          <Link
            href="/choose"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors w-full"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Menu
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
