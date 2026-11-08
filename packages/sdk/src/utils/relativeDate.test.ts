import { describe, expect, it } from "vitest";
import { formatRelativeDate } from "./relativeDate.ts";

/** Local dates, so the calendar-day arithmetic is tested in the runner's zone. */
const now = new Date(2026, 9, 14, 10, 0);
const at = (day: number, hour: number, minute = 0, year = 2026): Date =>
  new Date(year, 9, day, hour, minute);

const format = (date: Date): string =>
  formatRelativeDate(date, { now, locale: "en-GB" });

describe("formatRelativeDate", () => {
  it("says today, with the time", () => {
    expect(format(at(14, 8, 5))).toBe("today 08:05");
  });

  /** Calendar days, not 24-hour spans. */
  it("says yesterday for late last night", () => {
    expect(format(at(13, 23, 50))).toBe("yesterday 23:50");
  });

  it("names the weekday within the last week", () => {
    expect(format(at(12, 14, 32))).toBe("last Monday 14:32");
    expect(format(at(8, 9, 0))).toBe("last Thursday 09:00");
  });

  /** Seven days back is the same weekday as today: the weekday alone misleads. */
  it("falls back to the date from a week back", () => {
    expect(format(at(7, 9, 0))).toBe("7 Oct, 09:00");
  });

  it("adds the year once it is not this one", () => {
    expect(format(at(7, 9, 0, 2025))).toBe("7 Oct 2025, 09:00");
  });

  it("reads an ISO string", () => {
    expect(
      formatRelativeDate(at(14, 8, 5).toISOString(), { now, locale: "en-GB" }),
    ).toBe("today 08:05");
  });

  it("says so for a value that is no date", () => {
    expect(formatRelativeDate("not a date", { now })).toBe("unknown date");
  });
});
