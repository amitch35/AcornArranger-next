/**
 * Shared helpers for operating on a Monday–Sunday calendar week.
 *
 * Why Monday–Sunday?
 * Sunday is the busiest operational day, so ending the week on Sunday keeps
 * "this week" meaningful for Sunday-added appointments for as long as possible
 * before rolling into the next week.
 *
 * All helpers work in the browser's local time zone and return date-only
 * `YYYY-MM-DD` strings rather than ISO timestamps — this avoids the common
 * `toISOString()` off-by-one bug when the caller is east of UTC.
 */

const DAY_LABELS_MON_SUN = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

export type WeekdayLabelMonSun = (typeof DAY_LABELS_MON_SUN)[number];

/** Format a Date as a local `YYYY-MM-DD` string (no timezone conversion). */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today at local midnight. */
export function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Return the Monday (at local midnight) of the week containing `date`. */
export function getMondayOfWeekContaining(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // JS `getDay()`: Sun=0, Mon=1, …, Sat=6. Offset so Mon=0, …, Sun=6.
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

/** Return the Sunday (at local midnight) six days after the given Monday. */
export function getSundayOfSameWeek(monday: Date): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d;
}

/**
 * Return the Mon–Sun bounds of the week containing `date` as local
 * `YYYY-MM-DD` strings. Suitable for query params like `dateFrom`/`dateTo`.
 */
export function getWeekRangeContaining(date: Date): {
  start: string;
  end: string;
  mondayDate: Date;
  sundayDate: Date;
} {
  const mondayDate = getMondayOfWeekContaining(date);
  const sundayDate = getSundayOfSameWeek(mondayDate);
  return {
    start: formatLocalDate(mondayDate),
    end: formatLocalDate(sundayDate),
    mondayDate,
    sundayDate,
  };
}

/**
 * Enumerate the seven days of a Mon–Sun week as `{ date, isoDate, label }`,
 * anchored to the supplied Monday. Useful for chart x-axes and day-by-day
 * bucketing.
 */
export function eachDayInWeek(
  monday: Date
): Array<{ date: Date; isoDate: string; label: WeekdayLabelMonSun }> {
  return DAY_LABELS_MON_SUN.map((label, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return { date: d, isoDate: formatLocalDate(d), label };
  });
}

/**
 * Given an ISO timestamp (or `YYYY-MM-DD` date string) and a Mon–Sun week
 * anchor, return the index 0–6 representing which weekday the timestamp falls
 * on within that week, or `null` if it is outside the week.
 */
export function weekdayIndexMonSun(
  timestamp: string,
  mondayIso: string
): number | null {
  const monday = parseIsoDate(mondayIso);
  const target = parseIsoDate(timestamp.slice(0, 10));
  const diffDays = Math.round(
    (target.getTime() - monday.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays < 0 || diffDays > 6) return null;
  return diffDays;
}

/** Parse a `YYYY-MM-DD` string into a local-midnight Date. */
function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
