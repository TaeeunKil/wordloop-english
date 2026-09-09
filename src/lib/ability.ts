import type { AbilityProfile } from "@/lib/types";

export const DEFAULT_ABILITY: AbilityProfile = { score: 500, level: 4, confidence: 0, sampleCount: 0 };

function numberInRange(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function mapAbility(value: unknown): AbilityProfile {
  if (!value || typeof value !== "object") return { ...DEFAULT_ABILITY };
  const row = value as Record<string, unknown>;
  const score = numberInRange(row.score, DEFAULT_ABILITY.score, 0, 1000);
  const level = Math.round(numberInRange(row.level ?? row.ability_level, DEFAULT_ABILITY.level, 1, 7));
  const confidence = numberInRange(row.confidence, DEFAULT_ABILITY.confidence, 0, 1);
  const sampleCount = Math.round(numberInRange(row.sampleCount ?? row.sample_count, DEFAULT_ABILITY.sampleCount, 0, Number.MAX_SAFE_INTEGER));
  return { score, level, confidence, sampleCount };
}
