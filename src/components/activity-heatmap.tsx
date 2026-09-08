"use client";
import { useRef, useState } from "react";
import { activityDays } from "@/lib/calendar";

export function ActivityHeatmap({ days, today, timeZone }: {
  days: { day: string; reviews: number }[]; today: string; timeZone: string;
}) {
  const calendar = activityDays(days, today);
  const [selected, setSelected] = useState(today);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const offset = new Date(calendar[0].day + "T00:00:00Z").getUTCDay();
  const active = calendar.find(day => day.day === selected) ?? calendar[calendar.length - 1];
  const total = calendar.reduce((sum, day) => sum + day.reviews, 0);
  const max = Math.max(1, ...calendar.map(day => day.reviews));
  function select(index: number) {
    const target = Math.max(0, Math.min(calendar.length - 1, index));
    setSelected(calendar[target].day);
    buttons.current[target]?.focus();
  }
  return <section className="activity-section" aria-labelledby="activity-heading">
    <div className="section-heading"><div><p className="eyebrow">A RECORD OF RETURNING</p><h2 id="activity-heading">최근 30일의 반복</h2></div><span className="small quiet">{calendar[0].day.slice(5).replace("-", ".")} — {today.slice(5).replace("-", ".")}</span></div>
    <div className="activity-layout"><div className="calendar-area">
      <div className="heatmap-scroll" role="region" aria-label="학습 달력. 작은 화면에서 가로 스크롤 가능" tabIndex={0}><div className="calendar-weekdays" aria-hidden="true">{["일", "월", "화", "수", "목", "금", "토"].map(day => <span key={day}>{day}</span>)}</div>
      <div className="heatmap" role="group" aria-label="날짜별 학습 응답 수. 방향키로 날짜 이동">
        {Array.from({ length: offset }, (_, i) => <span key={i} aria-hidden="true" />)}
        {calendar.map((day, i) => <button key={day.day} ref={el => { buttons.current[i] = el; }} type="button"
          className={`heat-cell heat-${day.reviews ? Math.max(1, Math.ceil(day.reviews / max * 4)) : 0}`}
          aria-label={`${day.day}, ${day.reviews}회 학습${day.day === today ? ", 오늘" : ""}`}
          aria-pressed={selected === day.day} tabIndex={selected === day.day ? 0 : -1}
          title={`${day.day} · ${day.reviews}회`}
          onClick={() => setSelected(day.day)}
          onKeyDown={event => {
            const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
            if (event.key in delta) { event.preventDefault(); select(i + delta[event.key]); }
            else if (event.key === "Home" || event.key === "End") { event.preventDefault(); select(event.key === "Home" ? 0 : calendar.length - 1); }
          }}><span>{Number(day.day.slice(-2))}</span>{day.day === today && <span className="today-marker" aria-hidden="true" />}</button>)}
      </div>
      </div><div className="heatmap-legend"><span>적게</span>{[0, 1, 2, 3, 4].map(level => <span key={level} className={`legend-cell heat-${level}`} aria-hidden="true" />)}<span>많이</span></div>
    </div><div className="activity-detail" aria-live="polite" aria-atomic="true">
      <p className="eyebrow">{active.day === today ? "TODAY" : "SELECTED DAY"}</p>
      <h3><time dateTime={active.day}>{Number(active.day.slice(5, 7))}월 {Number(active.day.slice(-2))}일</time></h3>
      <p className="selected-count">{active.reviews}<span>번의 떠올림</span></p>
      <p className="quiet">{active.reviews ? "이날의 응답이 학습 기록에 남아 있어요." : "이날은 저장된 학습 응답이 없습니다."}</p>
      <p className="small quiet">최근 30일간 {total}회 · {timeZone}<br />날짜를 선택하면 그날의 기록을 볼 수 있습니다.</p>
    </div></div>
    {!total && <p className="notice">아직 학습 기록이 없어요. 첫 응답을 저장하면 이곳에 표시됩니다.</p>}
  </section>;
}
