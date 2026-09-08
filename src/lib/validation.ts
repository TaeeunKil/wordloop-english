import { z } from "zod";
export const wordSchema = z.object({
  term: z.string().trim().min(1).max(200),
  meaning: z.string().trim().min(1).max(2000),
  example: z.string().trim().max(3000),
  note: z.string().trim().max(3000),
});
export const reviewSchema = z.object({
  id: z.uuid(), session_id: z.uuid(), word_id: z.uuid(),
  word_version: z.number().int().positive(), state_version: z.number().int().nonnegative(),
  mode: z.enum(["typed", "choice", "self"]), answer: z.string().max(2000),
  hint_used: z.boolean(), rating: z.enum(["good", "again"]).nullable(),
}).superRefine((v, ctx) => {
  if (v.mode === "self" ? v.rating === null || v.answer !== "" : v.rating !== null || !v.answer.trim()) {
    ctx.addIssue({ code: "custom", message: "응답 형식을 확인하세요." });
  }
});
export function percentage(correct: number, total: number) {
  return total ? `${Math.round(correct / total * 100)}%` : "—";
}
export function choiceOptions(term: string, alternatives: string[], random = Math.random) {
  const options = [...new Set(alternatives)].filter(x => x !== term);
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]];
  }
  const result = [term, ...options.slice(0, 3)];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
