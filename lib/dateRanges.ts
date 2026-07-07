export type DateRangeKind = "today" | "week" | "month" | "custom";

export type DateRange = { from: string; to: string };

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // days since Monday
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - diff);
  return start;
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function resolveDateRange(
  kind: DateRangeKind,
  today: Date,
  custom?: { from?: string; to?: string }
): DateRange {
  const todayISO = toISODate(today);

  switch (kind) {
    case "today":
      return { from: todayISO, to: todayISO };
    case "week":
      return { from: toISODate(startOfWeek(today)), to: todayISO };
    case "month":
      return { from: toISODate(startOfMonth(today)), to: todayISO };
    case "custom": {
      const from = custom?.from || todayISO;
      const to = custom?.to || todayISO;
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}
