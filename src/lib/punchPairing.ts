export interface PunchRecord {
  id: string;
  employeeId: string;
  timestamp: Date;
  type: string;
  isManual: boolean;
}

export interface PunchPair {
  clockIn: PunchRecord;
  clockOut: PunchRecord | null;
  hours: number;
}

export interface DayResult {
  date: string;
  pairs: PunchPair[];
  hasIssue: boolean;
  totalHours: number;
}

export function pairPunchesForDay(punches: PunchRecord[]): DayResult {
  const sorted = [...punches].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const pairs: PunchPair[] = [];
  const date = sorted[0]
    ? toLocalDateString(new Date(sorted[0].timestamp))
    : "";

  for (let i = 0; i < sorted.length; i += 2) {
    const clockIn = sorted[i];
    const clockOut = sorted[i + 1] ?? null;

    const hours = clockOut
      ? (new Date(clockOut.timestamp).getTime() -
          new Date(clockIn.timestamp).getTime()) /
        3600000
      : 0;

    pairs.push({ clockIn, clockOut, hours });
  }

  const totalHours = pairs.reduce((sum, p) => sum + p.hours, 0);
  const hasIssue = sorted.length % 2 !== 0;

  return { date, pairs, hasIssue, totalHours };
}

function toLocalDateString(d: Date): string {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function groupPunchesByDay(
  punches: PunchRecord[]
): Map<string, PunchRecord[]> {
  const groups = new Map<string, PunchRecord[]>();

  for (const punch of punches) {
    const date = toLocalDateString(new Date(punch.timestamp));
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(punch);
  }

  return groups;
}
