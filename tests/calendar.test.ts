import { describe, expect, it } from "vitest";
import { activityDays, currentStreak, dayKey, shiftDay } from "../src/lib/calendar";

describe("activity calendar", () => {
  it("uses the account time zone on either side of midnight", () => {
    const now = new Date("2026-09-08T00:30:00Z");
    expect(dayKey(now, "Asia/Seoul")).toBe("2026-09-08");
    expect(dayKey(now, "America/New_York")).toBe("2026-09-07");
  });
  it("builds 30 actual dates, fills inactive days, and ignores out-of-range events", () => {
    const result = activityDays([{ day: "2026-09-08", reviews: 3 }, { day: "2026-08-09", reviews: 99 }], "2026-09-08");
    expect(result).toHaveLength(30);
    expect(result[0]).toEqual({ day: "2026-08-10", reviews: 0 });
    expect(result.at(-1)).toEqual({ day: "2026-09-08", reviews: 3 });
    expect(result.reduce((sum, day) => sum + day.reviews, 0)).toBe(3);
  });
  it("crosses leap years, year boundaries and DST without skipping dates", () => {
    expect(shiftDay("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2026-03-08", 1)).toBe("2026-03-09");
  });
  it("keeps yesterday's streak before today's first review and stops at a gap", () => {
    const days = [{ day: "2026-09-07", reviews: 2 }, { day: "2026-09-06", reviews: 1 }, { day: "2026-09-04", reviews: 3 }];
    expect(currentStreak(days, "2026-09-08")).toBe(2);
    expect(currentStreak(days, "2026-09-09")).toBe(0);
    expect(currentStreak([...days, { day: "2026-09-08", reviews: 1 }], "2026-09-08")).toBe(3);
  });
  it("does not imply a streak beyond the 30-day source window", () => {
    const days = Array.from({ length: 40 }, (_, i) => ({ day: shiftDay("2026-09-08", -i), reviews: 1 }));
    expect(currentStreak(days, "2026-09-08")).toBe(30);
    expect(currentStreak([], "2026-09-08")).toBe(0);
  });
});
