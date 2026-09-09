import { describe, expect, it } from "vitest";
import { DEFAULT_ABILITY, mapAbility } from "@/lib/ability";

describe("ability profile mapping", () => {
  it("uses a safe neutral profile for missing or malformed RPC data", () => {
    expect(mapAbility(null)).toEqual(DEFAULT_ABILITY);
    expect(mapAbility({ score: "not-a-number", level: 99, confidence: -1, sample_count: -2 }))
      .toEqual({ score: 500, level: 7, confidence: 0, sampleCount: 0 });
  });

  it("maps database-shaped values into bounded client values", () => {
    expect(mapAbility({ score: "742.50", ability_level: 6, confidence: "0.65", sample_count: "13" }))
      .toEqual({ score: 742.5, level: 6, confidence: 0.65, sampleCount: 13 });
  });
});
