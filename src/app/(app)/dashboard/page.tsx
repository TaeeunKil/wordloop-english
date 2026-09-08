import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { percentage } from "@/lib/validation";
import type { Stats } from "@/lib/types";
export default async function Dashboard() {
  const { client } = await requireUser();
  const [result, settings] = await Promise.all([client.rpc("study_stats"), client.from("user_settings").select("daily_goal,time_zone").maybeSingle()]);
  if (result.error || settings.error) throw new Error("Unable to load dashboard");
  const stats = result.data as Stats;
  const goal = settings.data?.daily_goal ?? 20;
  const timeZone = settings.data?.time_zone ?? "Asia/Seoul";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const count = stats.days.find(d => d.day === today)?.reviews ?? 0;
  return <><div className="page-heading"><div><p className="eyebrow">YOUR DAILY PRACTICE</p><h1>오늘의 학습<span className="accent">.</span></h1></div><p className="quiet">{today} · {timeZone}</p></div>
    <section className="dashboard-focus"><div><p className="eyebrow">READY TO RECALL</p><p className="big-number">{stats.due_words + stats.fresh_words}<span>단어</span></p><p>복습 {stats.due_words}개 · 새 단어 {stats.fresh_words}개</p>
      <Link href={stats.active_words ? "/study" : "/words"} className="button primary">{stats.active_words ? "학습 시작 / 이어하기" : "첫 단어 추가하기"} <span aria-hidden="true">↗</span></Link></div>
      <div className="daily-progress"><h2>하루의 작은 목표</h2><p><strong>{count}</strong> / {goal} 응답</p><progress value={Math.min(count, goal)} max={goal} aria-label="오늘의 학습 목표" /><p className="quiet">목표를 채운 뒤에도 계속 공부할 수 있어요.</p></div></section>
    <dl className="metrics"><div><dt>학습 중인 단어</dt><dd>{stats.active_words}</dd></div><div><dt>저장된 응답</dt><dd>{stats.total}</dd></div><div><dt>직접 입력 정답률 · 무힌트</dt><dd>{percentage(stats.typed_correct, stats.typed_total)}</dd></div></dl>
    <div className="section-heading"><h2>내 학습 관리</h2><Link href="/stats">전체 통계 →</Link></div>
    <div className="plain-row"><div><h3>단어장 정리</h3><p className="quiet">단어를 추가하고, 뜻과 예문을 다듬어 보세요.</p></div><Link href="/words" className="button">단어장 열기</Link></div>
  </>;
}
