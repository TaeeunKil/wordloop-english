import Link from "next/link";
import { StudyClient } from "@/components/study-client";
import { requireUser } from "@/lib/supabase/server";

export default async function StudyPage() {
  const { client, user } = await requireUser();
  const { data, error } = await client.from("user_settings").select("time_zone").eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Unable to load study settings");
  return <><div className="study-page-heading"><Link className="text-link" href="/dashboard">← 오늘로 돌아가기</Link><p className="eyebrow">RECALL / ONE WORD AT A TIME</p></div><h1 className="sr-only">오늘의 단어 학습</h1><StudyClient timeZone={data?.time_zone ?? "Asia/Seoul"} /></>;
}
