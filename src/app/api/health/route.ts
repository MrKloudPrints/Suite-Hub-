import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, string> = {};

  // Check env vars (don't reveal values)
  checks.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ? "SET" : "MISSING";
  checks.DATABASE_URL = process.env.DATABASE_URL ? "SET" : "MISSING";
  checks.NEXTAUTH_URL = process.env.NEXTAUTH_URL ? "SET" : "MISSING";
  checks.NODE_ENV = process.env.NODE_ENV || "not set";

  // Check module imports
  try {
    require("bcryptjs");
    checks.bcryptjs = "OK";
  } catch (e: unknown) {
    checks.bcryptjs = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    require("pg");
    checks.pg = "OK";
  } catch (e: unknown) {
    checks.pg = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    require("@prisma/client");
    checks.prisma_client = "OK";
  } catch (e: unknown) {
    checks.prisma_client = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    require("@prisma/adapter-pg");
    checks.prisma_adapter_pg = "OK";
  } catch (e: unknown) {
    checks.prisma_adapter_pg = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    require("next-auth");
    checks.next_auth = "OK";
  } catch (e: unknown) {
    checks.next_auth = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Try DB connection
  try {
    const { PrismaPg } = require("@prisma/adapter-pg");
    const { PrismaClient } = require("@prisma/client");
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    const prisma = new PrismaClient({ adapter });
    const count = await prisma.user.count();
    checks.db_connection = `OK (${count} users)`;
    await prisma.$disconnect();
  } catch (e: unknown) {
    checks.db_connection = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(checks, { status: 200 });
}
