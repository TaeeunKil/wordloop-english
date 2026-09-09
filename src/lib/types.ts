export type Word = {
  id: string; user_id: string; term: string; meaning: string; example: string; example_meaning: string; note: string;
  archived: boolean; version: number; created_at: string; updated_at: string;
  catalog_id?: string | null; origin?: "custom" | "catalog";
};
export type ReviewMode = "typed" | "choice" | "self";
export type StudyItem = Word & {
  stage: number; state_version: number; due_at: string | null;
  mastery_score: number; mastery_reviews: number;
  daily_source?: "due" | "fresh" | "catalog_random";
};
export type ReviewInput = {
  id: string; session_id: string; word_id: string; word_version: number; state_version: number;
  mode: ReviewMode; answer: string; hint_used: boolean; rating: "good" | "again" | null;
};
export type AbilityProfile = { score: number; level: number; confidence: number; sampleCount: number };
export type Receipt = {
  id: string; correct: boolean | null; expected_answer: string; stage: number; due_at: string; reviewed_at: string;
  masteryScore?: number; masteryDelta?: number; ability?: AbilityProfile;
};
export type Stats = {
  total: number; active_words: number; due_words: number; fresh_words: number;
  typed_total: number; typed_correct: number; assisted_total: number; assisted_correct: number;
  self_total: number; self_good: number; completed_sessions: number;
  days: { day: string; reviews: number }[];
  mistakes: { id: string; term: string; answer: string; reviewed_at: string }[];
};
export type ActionResult<T> = { data: T; error?: never } | { data?: never; error: string };
