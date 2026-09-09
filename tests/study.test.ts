import { describe, expect, it } from "vitest";
import { makeClozeParts } from "@/lib/study";

describe("study cloze prompts", () => {
  it("masks only the standalone target term", () => {
    expect(makeClozeParts("We need to improve our process.", "improve")).toEqual({
      matched: true,
      parts: [
        { kind: "text", value: "We need to " },
        { kind: "blank", value: "improve" },
        { kind: "text", value: " our process." },
      ],
    });
  });

  it("does not mask a term inside another word", () => {
    expect(makeClozeParts("The article is useful.", "art")).toEqual({
      matched: false,
      parts: [{ kind: "text", value: "The article is useful." }],
    });
  });

  it("matches phrases without changing their original casing", () => {
    expect(makeClozeParts("Please TAKE CARE of this.", "take care").parts).toEqual([
      { kind: "text", value: "Please " },
      { kind: "blank", value: "TAKE CARE" },
      { kind: "text", value: " of this." },
    ]);
  });
});
