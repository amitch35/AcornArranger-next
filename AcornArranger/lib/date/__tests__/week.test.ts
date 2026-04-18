import { describe, it, expect } from "vitest";
import {
  eachDayInWeek,
  formatLocalDate,
  getMondayOfWeekContaining,
  getSundayOfSameWeek,
  getWeekRangeContaining,
  weekdayIndexMonSun,
} from "../week";

describe("week helpers (Mon–Sun)", () => {
  describe("formatLocalDate", () => {
    it("zero-pads month and day", () => {
      const d = new Date(2026, 0, 3); // Jan 3, 2026
      expect(formatLocalDate(d)).toBe("2026-01-03");
    });
  });

  describe("getMondayOfWeekContaining", () => {
    it("returns the same day when input is a Monday", () => {
      const monday = new Date(2026, 3, 13); // Mon Apr 13, 2026
      const result = getMondayOfWeekContaining(monday);
      expect(formatLocalDate(result)).toBe("2026-04-13");
    });

    it("walks back to Monday from a Wednesday", () => {
      const wednesday = new Date(2026, 3, 15); // Wed Apr 15, 2026
      const result = getMondayOfWeekContaining(wednesday);
      expect(formatLocalDate(result)).toBe("2026-04-13");
    });

    it("walks back to Monday from a Sunday (Sunday ends the week)", () => {
      const sunday = new Date(2026, 3, 19); // Sun Apr 19, 2026
      const result = getMondayOfWeekContaining(sunday);
      expect(formatLocalDate(result)).toBe("2026-04-13");
    });

    it("crosses a month boundary correctly", () => {
      const wednesday = new Date(2026, 4, 6); // Wed May 6, 2026
      const result = getMondayOfWeekContaining(wednesday);
      expect(formatLocalDate(result)).toBe("2026-05-04");
    });
  });

  describe("getSundayOfSameWeek", () => {
    it("returns Monday + 6 days", () => {
      const monday = new Date(2026, 3, 13);
      const sunday = getSundayOfSameWeek(monday);
      expect(formatLocalDate(sunday)).toBe("2026-04-19");
    });
  });

  describe("getWeekRangeContaining", () => {
    it("produces Mon–Sun ISO strings for a mid-week date", () => {
      const thursday = new Date(2026, 3, 16); // Thu Apr 16, 2026
      const { start, end } = getWeekRangeContaining(thursday);
      expect(start).toBe("2026-04-13");
      expect(end).toBe("2026-04-19");
    });
  });

  describe("eachDayInWeek", () => {
    it("returns seven consecutive days labelled Mon → Sun", () => {
      const monday = new Date(2026, 3, 13);
      const days = eachDayInWeek(monday);
      expect(days.map((d) => d.label)).toEqual([
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun",
      ]);
      expect(days.map((d) => d.isoDate)).toEqual([
        "2026-04-13",
        "2026-04-14",
        "2026-04-15",
        "2026-04-16",
        "2026-04-17",
        "2026-04-18",
        "2026-04-19",
      ]);
    });
  });

  describe("weekdayIndexMonSun", () => {
    const mondayIso = "2026-04-13";

    it("returns 0 for the Monday itself", () => {
      expect(weekdayIndexMonSun("2026-04-13", mondayIso)).toBe(0);
    });

    it("returns 6 for the Sunday that ends the week", () => {
      expect(weekdayIndexMonSun("2026-04-19", mondayIso)).toBe(6);
    });

    it("accepts ISO timestamps with time components", () => {
      expect(weekdayIndexMonSun("2026-04-15T13:45:00Z", mondayIso)).toBe(2);
    });

    it("returns null for dates outside the week", () => {
      expect(weekdayIndexMonSun("2026-04-12", mondayIso)).toBeNull();
      expect(weekdayIndexMonSun("2026-04-20", mondayIso)).toBeNull();
    });
  });
});
