import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { currentStreak, dayKey } from "@/lib/calendar";
import type { Stats, Word } from "@/lib/types";

export default async function Dashboard() {
  const { client, user } = await requireUser();
  const [result, settings, recent] = await Promise.all([
    client.rpc("study_stats"),
    client.from("user_settings").select("daily_goal,time_zone").eq("user_id", user.id).maybeSingle(),
    client.from("words").select("id,term,meaning").eq("user_id", user.id).eq("archived", false).order("created_at", { ascending: false }).limit(4),
  ]);
  if (result.error || settings.error || recent.error) throw new Error("Unable to load dashboard");
  const stats = result.data as Stats;
  const goal = settings.data?.daily_goal ?? 20;
  const timeZone = settings.data?.time_zone ?? "Asia/Seoul";
  const today = dayKey(new Date(), timeZone);
  const count = stats.days.find(d => d.day === today)?.reviews ?? 0;
  const ready = stats.due_words + stats.fresh_words;
  const dailyTarget = Math.max(1, Math.min(goal, 200));
  return <>
    <div className="page-heading"><div><p className="eyebrow">TODAY / DAILY PRACTICE</p><h1>오늘의 학습</h1></div><p className="quiet small"><time dateTime={today}>{today.replaceAll("-", ".")}</time><br />{timeZone}</p></div>
    <section className="dashboard-focus" aria-labelledby="ready-heading"><div className="recall-focus">
      <h2 id="ready-heading">{ready ? "지금 떠올릴 단어" : "오늘의 랜덤 단어"}</h2>
      <p className="big-number">{ready || dailyTarget}<span>{ready ? "단어" : "개 준비"}</span></p>
      <p className="quiet">{ready ? `복습 ${stats.due_words}개 · 새 단어 ${stats.fresh_words}개` : `내 학습 트랙에 맞는 단어를 ${dailyTarget}개까지 골라 둡니다.`}</p>
      <Link href="/study" className="button primary">오늘의 학습 시작 <span aria-hidden="true">→</span></Link>
      <p className="small quiet session-note">복습 단어가 먼저 나오고, 빈자리는 카탈로그에서 무작위로 채웁니다.</p>
    </div><div className="daily-progress"><p className="eyebrow">TODAY’S PROGRESS</p><h2>오늘 남긴 반복</h2>
      <p className="goal-count"><strong>{count}</strong><span> / {goal} 응답</span></p>
      <progress value={Math.min(count, goal)} max={goal} aria-label={`오늘 목표 ${goal}회 중 ${count}회 완료`} />
      <p className="quiet">{count >= goal ? "오늘의 목표를 채웠어요. 남은 단어도 이어갈 수 있습니다." : `${Math.max(0, goal - count)}번 더 떠올리면 오늘의 목표에 도착해요.`}</p>
      <Link href="/stats" className="text-link">학습 기록 보기 →</Link>
    </div></section>
    <dl className="metrics"><div><dt>연속 학습 · 최근 30일 내</dt><dd>{currentStreak(stats.days, today)}<small>일</small></dd></div><div><dt>학습 중인 단어</dt><dd>{stats.active_words}<small>개</small></dd></div><div><dt>오늘 완료한 응답</dt><dd>{count}<small>회</small></dd></div></dl>
    <section><div className="section-heading"><h2>최근 담은 단어</h2><Link className="text-link" href="/words">단어장 전체 →</Link></div>
      {recent.data?.length ? <ul className="recent-words">{(recent.data as Pick<Word, "id" | "term" | "meaning">[]).map(word => <li key={word.id}><Link href={"/words?" + new URLSearchParams({ q: word.term })}><strong lang="en">{word.term}</strong><span>{word.meaning}</span><span aria-hidden="true">↗</span></Link></li>)}</ul>
        : <div className="empty"><h3>아직 담아둔 단어가 없어요.</h3><p>단어장에 표현을 추가하면 이곳에서 다시 만날 수 있습니다.</p><Link className="text-link" href="/words">단어 추가하러 가기 →</Link></div>}
    </section>
  </>;
}
