import { startOfWeek, endOfWeek, addWeeks, format } from "date-fns";

export function getPayPeriod(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start, end };
}

export function getAllPayPeriods(startDate: Date, endDate: Date) {
  const periods = [];
  let current = startOfWeek(startDate, { weekStartsOn: 1 });

  while (current <= endDate) {
    const end = endOfWeek(current, { weekStartsOn: 1 });
    periods.push({
      start: new Date(current),
      end,
      label: `${format(current, "MMM d")} - ${format(end, "MMM d, yyyy")}`,
    });
    current = addWeeks(current, 1);
  }

  return periods;
}

export function formatPayPeriod(start: Date, end: Date): string {
  return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
}
