import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CashSidebar } from "@/components/cash/CashSidebar";
import { CashHeader } from "@/components/cash/CashHeader";
import { SessionProvider } from "next-auth/react";

export default async function CashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/");

  return (
    <SessionProvider session={session}>
      <div className="flex h-screen bg-background">
        <CashSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CashHeader />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
