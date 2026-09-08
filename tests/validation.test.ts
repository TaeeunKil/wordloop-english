import { describe, expect, it } from "vitest";
import { choiceOptions, percentage, reviewSchema } from "@/lib/validation";

describe("WordLoop validation", () => {
  it("accepts typed reviews and rejects blank answers", () => {
    const base = { id: crypto.randomUUID(), session_id: crypto.randomUUID(), word_id: crypto.randomUUID(), word_version: 1, state_version: 0, mode: "typed" as const, hint_used: false, rating: null };
    expect(reviewSchema.safeParse({ ...base, answer: "remember" }).success).toBe(true);
    expect(reviewSchema.safeParse({ ...base, answer: "   " }).success).toBe(false);
  });
  it("creates up to four unique multiple-choice options", () => {
    const options = choiceOptions("learn", ["learn", "study", "practice", "learn"], () => .2);
    expect(options).toHaveLength(3);
    expect(new Set(options).size).toBe(options.length);
    expect(options).toContain("learn");
  });
  it("formats empty and non-empty rates", () => {
    expect(percentage(0, 0)).toBe("—");
    expect(percentage(3, 4)).toBe("75%");
  });
});
