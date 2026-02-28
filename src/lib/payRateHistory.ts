import { prisma } from "@/lib/db";

/**
 * Returns the pay rate that was effective for a given employee on a given date.
 * Finds the most recent PayRateHistory record where effectiveDate <= date.
 * Returns null if no history exists (caller should fall back to employee's current payRate).
 */
export async function getEffectivePayRate(
  employeeId: string,
  date: Date
): Promise<number | null> {
  const record = await prisma.payRateHistory.findFirst({
    where: {
      employeeId,
      effectiveDate: { lte: date },
    },
    orderBy: { effectiveDate: "desc" },
    select: { payRate: true },
  });

  return record?.payRate ?? null;
}

/**
 * Batch lookup: returns a Map of employeeId -> effective pay rate for a given date.
 * Single query instead of N+1.
 */
export async function getEffectivePayRates(
  employeeIds: string[],
  date: Date
): Promise<Map<string, number>> {
  const records = await prisma.payRateHistory.findMany({
    where: {
      employeeId: { in: employeeIds },
      effectiveDate: { lte: date },
    },
    orderBy: { effectiveDate: "desc" },
    select: { employeeId: true, payRate: true },
  });

  // First record per employee is the most recent (ordered desc)
  const rateMap = new Map<string, number>();
  for (const r of records) {
    if (!rateMap.has(r.employeeId)) {
      rateMap.set(r.employeeId, r.payRate);
    }
  }

  return rateMap;
}
