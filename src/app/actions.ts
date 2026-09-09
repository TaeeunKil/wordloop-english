"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getConfig } from "@/lib/env";
import { requireUser, serverClient } from "@/lib/supabase/server";
import { reviewSchema, wordSchema } from "@/lib/validation";
import { mapAbility } from "@/lib/ability";
import type { AbilityProfile, ActionResult, Receipt, ReviewInput, StudyItem, Word } from "@/lib/types";

function failure(message?: string) {
  if (message?.includes("IDEMPOTENCY_CONFLICT")) return "같은 응답 ID의 내용이 다릅니다. 저장 상태를 확인한 뒤 새로 불러오세요.";
  if (message && /STALE_|REVIEW_NOT_DUE|WORD_UNAVAILABLE|SESSION_CLOSED/.test(message)) return "다른 기기에서 단어나 학습 상태가 변경되었습니다. 현재 상태를 다시 불러오세요.";
  return "저장하지 못했습니다. 연결 또는 로그인 상태를 확인하고 같은 응답을 재시도하세요.";
}
async function loginWithProvider(provider: "github" | "google") {
  const config = getConfig();
  const client = await serverClient();
  if (!config || !client) redirect("/setup");
  const { data, error } = await client.auth.signInWithOAuth({
    provider, options: { redirectTo: config.site + "/auth/callback" },
  });
  if (error || !data.url) redirect("/?auth=failed");
  redirect(data.url);
}
export async function login() { return loginWithProvider("github"); }
export async function loginWithGoogle() { return loginWithProvider("google"); }
export async function logout() {
  const client = await serverClient();
  if (client) {
    const { error } = await client.auth.signOut();
    if (error) redirect("/?auth=logout-failed");
  }
  redirect("/");
}
export async function saveWord(input: unknown, id?: string, version?: number): Promise<ActionResult<Word>> {
  const { client, user } = await requireUser();
  const parsed = wordSchema.safeParse(input);
  if (!parsed.success) return { error: "단어와 뜻은 필수입니다. 입력 길이를 확인하세요." };
  const query = id
    ? client.from("words").update(parsed.data).eq("id", id).eq("user_id", user.id).eq("version", version ?? -1)
    : client.from("words").insert({ ...parsed.data, user_id: user.id });
  const { data, error } = await query.select().single();
  if (error || !data) return { error: id ? "수정하지 못했습니다. 다른 기기의 변경 사항을 새로 불러온 뒤 다시 시도하세요." : failure() };
  revalidatePath("/words"); revalidatePath("/dashboard");
  return { data: data as Word };
}
export async function archiveWord(id: string, version: number, archived: boolean): Promise<ActionResult<Word>> {
  const { client, user } = await requireUser();
  if (typeof archived !== "boolean") return { error: "보관 상태를 확인하세요." };
  const { data, error } = await client.from("words").update({ archived }).eq("user_id", user.id).eq("id", id).eq("version", version).select().single();
  if (error || !data) return { error: "변경하지 못했습니다. 목록을 새로 불러오세요." };
  revalidatePath("/words"); revalidatePath("/dashboard");
  return { data: data as Word };
}
export async function startStudy(): Promise<ActionResult<{ sessionId: string; queue: StudyItem[]; alternatives: string[]; day: string; trackCode: string; ability: AbilityProfile }>> {
  const { client, user } = await requireUser();
  const { data, error } = await client.rpc("start_daily_session");
  if (error || !data) return { error: failure(error?.message) };
  const plan = data as { session_id?: string; queue?: StudyItem[]; day?: string; track_code?: string; ability?: unknown };
  if (!plan.session_id || !plan.day || !plan.track_code || !Array.isArray(plan.queue)) return { error: "오늘의 학습 목록을 불러오지 못했습니다. 다시 시도하세요." };
  const words = await client.from("words").select("term").eq("user_id", user.id).eq("archived", false).order("id").limit(100);
  if (words.error) return { error: "학습 선택지를 불러오지 못했습니다. 다시 시도하세요." };
  return { data: { sessionId: plan.session_id, queue: plan.queue, day: plan.day, trackCode: plan.track_code, alternatives: (words.data ?? []).map(w => w.term as string), ability: mapAbility(plan.ability) } };
}
export async function submitReview(input: ReviewInput): Promise<ActionResult<Receipt>> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { error: "응답 형식을 확인하세요." };
  const { client, user } = await requireUser();
  const p = parsed.data;
  const { data, error } = await client.rpc("submit_review", {
    p_id: p.id, p_session_id: p.session_id, p_word_id: p.word_id,
    p_word_version: p.word_version, p_state_version: p.state_version,
    p_mode: p.mode, p_answer: p.answer, p_hint_used: p.hint_used, p_rating: p.rating,
  });
  if (error || !data) return { error: failure(error?.message) };
  revalidatePath("/dashboard"); revalidatePath("/stats");
  const ability = await client.from("user_ability").select("score,ability_level,confidence,sample_count").eq("user_id", user.id).maybeSingle();
  const rawReceipt = data as Receipt & { mastery_score?: unknown; mastery_delta?: unknown };
  const masteryScore = Number(rawReceipt.mastery_score);
  const masteryDelta = Number(rawReceipt.mastery_delta);
  const receipt: Receipt = {
    ...rawReceipt,
    ...(Number.isFinite(masteryScore) ? { masteryScore } : {}),
    ...(Number.isFinite(masteryDelta) ? { masteryDelta } : {}),
  };
  return { data: ability.data ? { ...receipt, ability: mapAbility(ability.data) } : receipt };
}
export async function finishStudy(sessionId: string): Promise<ActionResult<true>> {
  const { client } = await requireUser();
  const { error } = await client.rpc("finish_session", { p_session_id: sessionId });
  if (error) return { error: failure(error.message) };
  revalidatePath("/dashboard"); revalidatePath("/stats");
  return { data: true };
}
export async function saveSettings(timeZone: string, dailyGoal: number): Promise<ActionResult<true>> {
  const { client, user } = await requireUser();
  if (!["Asia/Seoul", "UTC", "America/New_York", "Europe/London", "Asia/Tokyo"].includes(timeZone) || !Number.isInteger(dailyGoal) || dailyGoal < 1 || dailyGoal > 200) return { error: "설정 값을 확인하세요." };
  const { error } = await client.from("user_settings").upsert({ user_id: user.id, time_zone: timeZone, daily_goal: dailyGoal });
  if (error) return { error: failure() };
  revalidatePath("/dashboard"); revalidatePath("/stats");
  return { data: true };
}
