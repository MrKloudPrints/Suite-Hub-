/**
 * One-time migration script: SQLite (dev.db) → PostgreSQL
 *
 * Usage:
 *   1. Make sure your .env has the correct DATABASE_URL pointing to Postgres
 *   2. Run: npx prisma migrate deploy   (creates tables in Postgres)
 *   3. Run: npx tsx scripts/migrate-sqlite-to-postgres.ts
 *
 * This reads all data from prisma/dev.db and inserts it into your Postgres database.
 * Tables are migrated in foreign-key order so references are satisfied.
 */

import "dotenv/config";
import Database from "better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import path from "path";

const SQLITE_PATH = path.resolve(__dirname, "../prisma/dev.db");

// ── Connect to both databases ───────────────────────────────────────

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ── Helper: read all rows from a SQLite table ──────────────────────

function readAll<T>(table: string): T[] {
  return sqlite.prepare(`SELECT * FROM "${table}"`).all() as T[];
}

// ── Helper: convert SQLite integer booleans (0/1) to real booleans ──

function toBool(val: number | boolean | null | undefined): boolean {
  if (typeof val === "boolean") return val;
  return val === 1;
}

// ── Helper: convert SQLite date strings/integers to Date objects ─────

function toDate(val: string | number | null | undefined): Date {
  if (!val) return new Date();
  if (typeof val === "number") return new Date(val);
  return new Date(val);
}

// ── Migration functions (in FK-safe order) ─────────────────────────

async function migrateUsers() {
  const rows = readAll<{
    id: string; username: string; passwordHash: string;
    role: string; createdAt: string; updatedAt: string;
  }>("User");

  let count = 0;
  for (const r of rows) {
    try {
      await prisma.user.create({
        data: {
          id: r.id,
          username: r.username,
          passwordHash: r.passwordHash,
          role: r.role,
          createdAt: toDate(r.createdAt),
          updatedAt: toDate(r.updatedAt),
        },
      });
      count++;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "P2002") {
        console.log(`  Skip duplicate user: ${r.username}`);
      } else throw e;
    }
  }
  console.log(`  Users: ${count}/${rows.length}`);
}

async function migrateEmployees() {
  const rows = readAll<{
    id: string; code: string; name: string; payRate: number;
    overtimeEnabled: number; overtimeThreshold: number; overtimeMultiplier: number;
    active: number; createdAt: string; updatedAt: string;
  }>("Employee");

  let count = 0;
  for (const r of rows) {
    try {
      await prisma.employee.create({
        data: {
          id: r.id,
          code: r.code,
          name: r.name || "",
          payRate: r.payRate,
          overtimeEnabled: toBool(r.overtimeEnabled),
          overtimeThreshold: r.overtimeThreshold,
          overtimeMultiplier: r.overtimeMultiplier,
          active: toBool(r.active),
          createdAt: toDate(r.createdAt),
          updatedAt: toDate(r.updatedAt),
        },
      });
      count++;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "P2002") {
        console.log(`  Skip duplicate employee: ${r.code}`);
      } else throw e;
    }
  }
  console.log(`  Employees: ${count}/${rows.length}`);
}

async function migratePayRateHistory() {
  const rows = readAll<{
    id: string; employeeId: string; payRate: number;
    effectiveDate: string; createdAt: string;
  }>("PayRateHistory");

  let count = 0;
  for (const r of rows) {
    try {
      await prisma.payRateHistory.create({
        data: {
          id: r.id,
          employeeId: r.employeeId,
          payRate: r.payRate,
          effectiveDate: toDate(r.effectiveDate),
          createdAt: toDate(r.createdAt),
        },
      });
      count++;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "P2002") continue;
      else throw e;
    }
  }
  console.log(`  PayRateHistory: ${count}/${rows.length}`);
}

async function migratePunches() {
  const rows = readAll<{
    id: string; employeeId: string; timestamp: string; type: string;
    isManual: number; source: string; rawLine: string | null;
    createdAt: string; updatedAt: string;
  }>("Punch");

  console.log(`  Punches: inserting ${rows.length} records (this may take a moment)...`);

  // Batch insert for performance
  const BATCH = 500;
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    try {
      const result = await prisma.punch.createMany({
        data: batch.map((r) => ({
          id: r.id,
          employeeId: r.employeeId,
          timestamp: toDate(r.timestamp),
          type: r.type,
          isManual: toBool(r.isManual),
          source: r.source,
          rawLine: r.rawLine || null,
          createdAt: toDate(r.createdAt),
          updatedAt: toDate(r.updatedAt),
        })),
        skipDuplicates: true,
      });
      count += result.count;
    } catch (e) {
      console.error(`  Error in punch batch ${i}-${i + BATCH}:`, e);
    }
  }
  console.log(`  Punches: ${count}/${rows.length}`);
}

async function migratePayouts() {
  const rows = readAll<{
    id: string; employeeId: string; amount: number; type: string;
    method: string | null; description: string; date: string;
    createdAt: string; updatedAt: string;
  }>("Payout");

  let count = 0;
  for (const r of rows) {
    try {
      await prisma.payout.create({
        data: {
          id: r.id,
          employeeId: r.employeeId,
          amount: r.amount,
          type: r.type,
          method: r.method || null,
          description: r.description || "",
          date: toDate(r.date),
          createdAt: toDate(r.createdAt),
          updatedAt: toDate(r.updatedAt),
        },
      });
      count++;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "P2002") continue;
      else throw e;
    }
  }
  console.log(`  Payouts: ${count}/${rows.length}`);
}

async function migrateSettings() {
  const rows = readAll<{ id: string; key: string; value: string }>("Setting");

  let count = 0;
  for (const r of rows) {
    try {
      await prisma.setting.create({
        data: { id: r.id, key: r.key, value: r.value },
      });
      count++;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "P2002") {
        console.log(`  Skip duplicate setting: ${r.key}`);
      } else throw e;
    }
  }
  console.log(`  Settings: ${count}/${rows.length}`);
}

async function migrateCashEntries() {
  const rows = readAll<{
    id: string; type: string; amount: number; registerAmount: number;
    depositAmount: number; changeGiven: number; category: string | null;
    source: string; customerName: string | null; invoiceNumber: string | null;
    notes: string | null; date: string; userId: string;
    createdAt: string; updatedAt: string;
  }>("CashEntry");

  let count = 0;
  for (const r of rows) {
    try {
      await prisma.cashEntry.create({
        data: {
          id: r.id,
          type: r.type,
          amount: r.amount,
          registerAmount: r.registerAmount,
          depositAmount: r.depositAmount,
          changeGiven: r.changeGiven,
          category: r.category || null,
          source: r.source,
          customerName: r.customerName || null,
          invoiceNumber: r.invoiceNumber || null,
          notes: r.notes || null,
          date: toDate(r.date),
          userId: r.userId,
          createdAt: toDate(r.createdAt),
          updatedAt: toDate(r.updatedAt),
        },
      });
      count++;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "P2002") continue;
      else throw e;
    }
  }
  console.log(`  CashEntries: ${count}/${rows.length}`);
}

async function migrateExpenses() {
  const rows = readAll<{
    id: string; amount: number; description: string; category: string;
    source: string; paidById: string | null; paidByName: string;
    outOfPocket: number; reimbursed: number; receiptPath: string | null;
    date: string; userId: string; createdAt: string; updatedAt: string;
  }>("Expense");

  let count = 0;
  for (const r of rows) {
    try {
      await prisma.expense.create({
        data: {
          id: r.id,
          amount: r.amount,
          description: r.description,
          category: r.category,
          source: r.source,
          paidById: r.paidById || null,
          paidByName: r.paidByName || "",
          outOfPocket: toBool(r.outOfPocket),
          reimbursed: toBool(r.reimbursed),
          receiptPath: r.receiptPath || null,
          date: toDate(r.date),
          userId: r.userId,
          createdAt: toDate(r.createdAt),
          updatedAt: toDate(r.updatedAt),
        },
      });
      count++;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "P2002") continue;
      else throw e;
    }
  }
  console.log(`  Expenses: ${count}/${rows.length}`);
}

async function migrateReconciliations() {
  const rows = readAll<{
    id: string; expectedBalance: number; actualBalance: number; discrepancy: number;
    registerExpected: number; registerActual: number;
    depositExpected: number; depositActual: number;
    notes: string | null; date: string; userId: string;
    createdAt: string; updatedAt: string;
  }>("CashReconciliation");

  let count = 0;
  for (const r of rows) {
    try {
      await prisma.cashReconciliation.create({
        data: {
          id: r.id,
          expectedBalance: r.expectedBalance,
          actualBalance: r.actualBalance,
          discrepancy: r.discrepancy,
          registerExpected: r.registerExpected,
          registerActual: r.registerActual,
          depositExpected: r.depositExpected,
          depositActual: r.depositActual,
          notes: r.notes || null,
          date: toDate(r.date),
          userId: r.userId,
          createdAt: toDate(r.createdAt),
          updatedAt: toDate(r.updatedAt),
        },
      });
      count++;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "P2002") continue;
      else throw e;
    }
  }
  console.log(`  Reconciliations: ${count}/${rows.length}`);
}

async function migrateRegisterResets() {
  const rows = readAll<{
    id: string; amount: number; weekStart: string;
    notes: string | null; createdAt: string; updatedAt: string;
  }>("RegisterReset");

  let count = 0;
  for (const r of rows) {
    try {
      await prisma.registerReset.create({
        data: {
          id: r.id,
          amount: r.amount,
          weekStart: toDate(r.weekStart),
          notes: r.notes || null,
          createdAt: toDate(r.createdAt),
          updatedAt: toDate(r.updatedAt),
        },
      });
      count++;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "P2002") continue;
      else throw e;
    }
  }
  console.log(`  RegisterResets: ${count}/${rows.length}`);
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nSQLite → PostgreSQL Migration`);
  console.log(`Source: ${SQLITE_PATH}`);
  console.log(`Target: ${process.env.DATABASE_URL?.replace(/:[^@]+@/, ':***@')}\n`);

  // Migrate in FK-safe order (parents first, then children)
  console.log("Migrating tables...\n");

  await migrateUsers();
  await migrateEmployees();
  await migratePayRateHistory();
  await migratePunches();
  await migratePayouts();
  await migrateSettings();
  await migrateCashEntries();
  await migrateExpenses();
  await migrateReconciliations();
  await migrateRegisterResets();

  console.log("\nMigration complete!");
  console.log("You can now remove better-sqlite3 dev dep: npm uninstall better-sqlite3 @types/better-sqlite3");
}

main()
  .catch((e) => {
    console.error("\nMigration failed:", e);
    process.exit(1);
  })
  .finally(() => {
    sqlite.close();
    prisma.$disconnect();
  });
