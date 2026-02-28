import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (entry && now > entry.resetAt) {
    loginAttempts.delete(ip);
    return false;
  }

  if (!entry) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 }); // 15 min window
    return false;
  }

  entry.count++;
  return entry.count > 10; // max 10 attempts per 15 min
}

// Clean up expired entries every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of loginAttempts) {
      if (now > entry.resetAt) loginAttempts.delete(key);
    }
  }, 10 * 60 * 1000);
}

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  // Rate limit login POST requests
  if (
    req.nextUrl.pathname.startsWith("/api/auth/callback/credentials") &&
    req.method === "POST"
  ) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (checkLoginRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again in 15 minutes." },
        { status: 429 }
      );
    }
  }

  // Auth check is handled by the authConfig.callbacks.authorized
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/cash/:path*",
    "/choose",
    "/register/:path*",
    "/register",
    "/api/auth/callback/:path*",
  ],
};
