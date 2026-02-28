import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SessionProvider } from "next-auth/react";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Cash Register",
  appleWebApp: {
    capable: true,
    title: "Cash Register",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/");

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-slate-900 text-white select-none overflow-hidden">
        {children}
      </div>
    </SessionProvider>
  );
}
