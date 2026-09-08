import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { dayKey, reviewDate } from "@/lib/calendar";
import type { Stats } from "@/lib/types";
import { percentage } from "@/lib/validation";

export default async function StatsPage() {
  const { client, user } = await requireUser();
  const [result, settings] = await Promise.all([
    client.rpc("study_stats"),
    client.from("user_settings").select("time_zone").eq("user_id", user.id).maybeSingle(),
  ]);
  if (result.error || settings.error) throw new Error("Unable to load stats");
  const stats = result.data as Stats;
  const timeZone = settings.data?.time_zone ?? "Asia/Seoul";
  const today = dayKey(new Date(), timeZone);
  return <>
    <div className="page-heading"><div><p className="eyebrow">RECORD / YOUR PRACTICE</p><h1>쌓이는 기록</h1></div><Link className="button" href="/study">오늘의 학습 →</Link></div>
    <ActivityHeatmap days={stats.days} today={today} timeZone={timeZone} />
    <dl className="metrics four"><div><dt>전체 학습 응답</dt><dd>{stats.total}<small>회</small></dd></div><div><dt>직접 입력 정답률 · 무힌트</dt><dd>{percentage(stats.typed_correct, stats.typed_total)}</dd></div><div><dt>완료한 세션</dt><dd>{stats.completed_sessions}<small>회</small></dd></div><div><dt>학습 중인 단어</dt><dd>{stats.active_words}<small>개</small></dd></div></dl>
    <section className="performance-section"><div className="section-heading"><h2>어떻게 떠올렸나요?</h2><span className="small quiet">전체 기간</span></div>
      <dl className="performance-list">
        <div><dt>직접 입력 <span className="small quiet">힌트 없이</span></dt><dd>{stats.typed_correct} / {stats.typed_total} 정답</dd></div>
        <div><dt>도움을 받은 응답 <span className="small quiet">힌트·객관식</span></dt><dd>{stats.assisted_correct} / {stats.assisted_total} 정답</dd></div>
        <div><dt>스스로 확인 <span className="small quiet">정답률에 미포함</span></dt><dd>{stats.self_good} / {stats.self_total} 알고 있었어요</dd></div>
      </dl>
    </section>
    <section><div className="section-heading"><h2>다시 기억할 단어</h2><span className="small quiet">최근 오답 · 최대 20개</span></div>
      {stats.mistakes.length ? <ul className="mistake-list">{stats.mistakes.map(mistake => <li key={mistake.id}>
        <div><Link className="word-link" lang="en" href={"/words?" + new URLSearchParams({ q: mistake.term })}>{mistake.term}</Link><p className="quiet">내 답: <span lang="en">{mistake.answer || "(스스로 확인)"}</span></p></div>
        <time className="small quiet" dateTime={mistake.reviewed_at}>{reviewDate(mistake.reviewed_at, timeZone)}</time>
      </li>)}</ul> : <div className="empty"><h3>아직 틀린 기록이 없어요.</h3><p>틀린 표현은 이곳에 모아 두고 다시 확인할 수 있습니다.</p></div>}
    </section>
  </>;
}
