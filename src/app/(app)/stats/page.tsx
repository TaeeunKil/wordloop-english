import { requireUser } from "@/lib/supabase/server";
import type { Stats } from "@/lib/types";
import { percentage } from "@/lib/validation";

export default async function StatsPage() {
  const { client } = await requireUser();
  const { data, error } = await client.rpc("study_stats");
  if (error) throw new Error("Unable to load stats");
  const stats = data as Stats;
  const max = Math.max(1, ...stats.days.map(day => day.reviews));
  return <><div className="page-heading"><div><p className="eyebrow">A RECORD OF RETURNING</p><h1>학습 통계<span className="accent">.</span></h1></div></div>
    <section className="stat-grid">
      <div><span className="quiet">전체 응답</span><strong>{stats.total}</strong></div>
      <div><span className="quiet">직접 입력 정답률</span><strong>{percentage(stats.typed_correct, stats.typed_total)}</strong></div>
      <div><span className="quiet">완료한 세션</span><strong>{stats.completed_sessions}</strong></div>
      <div><span className="quiet">학습 단어</span><strong>{stats.active_words}</strong></div>
    </section>
    <section><div className="section-heading"><h2>최근 30일</h2><span className="quiet">하루 응답 수</span></div><div className="days">{stats.days.length ? stats.days.slice(0, 30).reverse().map(day => <div className="day" key={day.day} title={`${day.day}: ${day.reviews}개`}><div className="day-bar" style={{ height: `${Math.max(6, Math.round(day.reviews / max * 120))}px` }} /><span>{day.day.slice(5)}</span></div>) : <p className="quiet">아직 기록이 없습니다. 오늘 한 단어부터 시작해 보세요.</p>}</div></section>
    <section><div className="section-heading"><h2>최근 틀린 단어</h2><span className="quiet">최대 20개</span></div>{stats.mistakes.length ? <div className="word-list">{stats.mistakes.map(mistake => <div className="plain-row" key={mistake.id}><div><strong lang="en">{mistake.term}</strong><p className="quiet">내 답: {mistake.answer || "(스스로 확인)"}</p></div><time className="quiet">{new Date(mistake.reviewed_at).toLocaleDateString("ko-KR")}</time></div>)}</div> : <div className="empty"><p>아직 틀린 기록이 없습니다.</p></div>}</section>
  </>;
}
