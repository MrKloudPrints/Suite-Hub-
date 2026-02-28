import { DayResult, PunchRecord, pairPunchesForDay, groupPunchesByDay } from "./punchPairing";
import { startOfWeek, endOfWeek } from "date-fns";

export interface WeeklyHours {
  weekStart: Date;
  weekEnd: Date;
  dailyBreakdown: DayResult[];
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  grossPay: number;
  issues: DayResult[];
}

export function calculateWeeklyHours(
  punches: PunchRecord[],
  payRate: number,
  overtimeEnabled: boolean,
  overtimeThreshold: number,
  overtimeMultiplier: number
): WeeklyHours {
  const dayGroups = groupPunchesByDay(punches);
  const dailyBreakdown: DayResult[] = [];

  for (const [, dayPunches] of dayGroups) {
    dailyBreakdown.push(pairPunchesForDay(dayPunches));
  }

  dailyBreakdown.sort((a, b) => a.date.localeCompare(b.date));

  const totalHours = dailyBreakdown.reduce((sum, d) => sum + d.totalHours, 0);

  let regularHours: number;
  let overtimeHours: number;

  if (overtimeEnabled && totalHours > overtimeThreshold) {
    regularHours = overtimeThreshold;
    overtimeHours = totalHours - overtimeThreshold;
  } else {
    regularHours = totalHours;
    overtimeHours = 0;
  }

  const regularPay = regularHours * payRate;
  const overtimePay = overtimeHours * payRate * overtimeMultiplier;
  const grossPay = regularPay + overtimePay;
  const issues = dailyBreakdown.filter((d) => d.hasIssue);

  const refDate =
    dailyBreakdown[0]?.date ? new Date(dailyBreakdown[0].date) : new Date();

  return {
    weekStart: startOfWeek(refDate, { weekStartsOn: 1 }),
    weekEnd: endOfWeek(refDate, { weekStartsOn: 1 }),
    dailyBreakdown,
    totalHours,
    regularHours,
    overtimeHours,
    regularPay,
    overtimePay,
    grossPay,
    issues,
  };
}
