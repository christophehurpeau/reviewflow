/**
 * A past date the way the operator says it: "today 14:32", "yesterday 09:10",
 * "last Monday 16:05", then "12 Oct, 14:32" — and the year once it is not this
 * one. The boards read dates to answer "is this from this morning or last
 * week", which a full timestamp makes them work out.
 *
 * Calendar days in the machine's own time zone, not 24-hour spans: 23:50
 * yesterday is "yesterday" at 00:10. The time and the month follow the
 * locale; the words are the app's, which is in English.
 */

const dayMs = 24 * 60 * 60 * 1000;

/** how many days back the weekday alone still names the day without doubt */
const weekdayReach = 6;

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Whole calendar days from `date` to `now`; negative for a future date. */
const calendarDaysAgo = (date: Date, now: Date): number =>
  Math.round((startOfDay(now) - startOfDay(date)) / dayMs);

export interface FormatRelativeDateOptions {
  now?: Date;
  /** a BCP 47 tag; the runtime's own when absent */
  locale?: string;
}

export const formatRelativeDate = (
  value: Date | string,
  { now = new Date(), locale }: FormatRelativeDateOptions = {},
): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "unknown date";

  const time = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const days = calendarDaysAgo(date, now);

  if (days === 0) return `today ${time}`;
  if (days === 1) return `yesterday ${time}`;
  if (days > 1 && days <= weekdayReach) {
    const weekday = date.toLocaleDateString("en", { weekday: "long" });
    return `last ${weekday} ${time}`;
  }

  const day = date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
  return `${day}, ${time}`;
};
