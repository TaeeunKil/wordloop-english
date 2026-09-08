"use client";

import { useState, useTransition } from "react";
import { finishStudy, startStudy, submitReview } from "@/app/actions";
import type { StudyItem } from "@/lib/types";
import { choiceOptions } from "@/lib/validation";

type Session = { id: string; queue: StudyItem[]; alternatives: string[] };

export function StudyClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean | null; expected: string } | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const item = session?.queue[index];

  function begin() {
    setError("");
    startTransition(async () => {
      const result = await startStudy();
      if (result.error || !result.data) setError(result.error ?? "학습 목록을 불러오지 못했습니다.");
      else {
        setSession({ id: result.data.sessionId, queue: result.data.queue, alternatives: result.data.alternatives });
        setIndex(0);
        setAnswer("");
        setHint(false);
        setFeedback(null);
      }
    });
  }

  function review(mode: "typed" | "choice", selected: string) {
    if (!session || !item || feedback) return;
    setError("");
    setAnswer(selected);
    startTransition(async () => {
      const result = await submitReview({
        id: crypto.randomUUID(), session_id: session.id, word_id: item.id,
        word_version: item.version, state_version: item.state_version,
        mode, answer: selected, hint_used: hint, rating: null,
      });
      if (result.error || !result.data) setError(result.error ?? "응답을 저장하지 못했습니다.");
      else setFeedback({ correct: result.data.correct, expected: result.data.expected_answer });
    });
  }

  function selfRate(rating: "good" | "again") {
    if (!session || !item || feedback) return;
    startTransition(async () => {
      const result = await submitReview({
        id: crypto.randomUUID(), session_id: session.id, word_id: item.id,
        word_version: item.version, state_version: item.state_version,
        mode: "self", answer: "", hint_used: false, rating,
      });
      if (result.error || !result.data) setError(result.error ?? "응답을 저장하지 못했습니다.");
      else setFeedback({ correct: null, expected: result.data.expected_answer });
    });
  }

  function next() {
    if (!session) return;
    if (index + 1 >= session.queue.length) {
      startTransition(async () => {
        const result = await finishStudy(session.id);
        if (result.error || !result.data) setError(result.error ?? "학습 세션을 닫지 못했습니다.");
        else { setSession(null); setFeedback(null); setIndex(0); }
      });
      return;
    }
    setIndex(value => value + 1);
    setAnswer("");
    setHint(false);
    setFeedback(null);
  }

  if (!session) return <section className="study-card">
    <p className="eyebrow">RECALL SESSION</p>
    <h2>오늘의 단어를<br />꺼내 보세요.</h2>
    <p className="quiet">뜻을 보고 영어 단어를 직접 떠올리면 복습 기록이 남습니다. 힌트를 사용해도 괜찮아요.</p>
    {error && <p className="notice" role="alert">{error}</p>}
    <button className="primary" onClick={begin} disabled={pending}>{pending ? "준비 중…" : "학습 시작하기 ↗"}</button>
  </section>;

  if (!item) return <section className="study-card"><h2>오늘 학습 완료.</h2><p className="quiet">복습할 단어가 없습니다. 단어장에서 새 단어를 추가해 보세요.</p><button onClick={next} disabled={pending}>세션 닫기</button></section>;

  const options = choiceOptions(item.term, session.alternatives);
  return <section className="study-card">
    <div className="section-heading"><p className="eyebrow">{String(index + 1).padStart(2, "0")} / {String(session.queue.length).padStart(2, "0")}</p><span className="quiet">stage {item.stage}</span></div>
    <h2>{item.meaning}</h2>
    {item.example && <p className="quiet" lang="en">{item.example}</p>}
    {hint && <p className="notice">힌트: {item.term.slice(0, 1)}… ({item.term.length}글자)</p>}
    {feedback ? <div className={feedback.correct === false ? "study-feedback wrong" : "study-feedback"} role="status">
      {feedback.correct === null ? <p>기록했어요. 정답은 <strong lang="en">{feedback.expected}</strong> 입니다.</p> : <p>{feedback.correct ? "정답이에요." : <>다음에 다시 만나요. 정답은 <strong lang="en">{feedback.expected}</strong> 입니다.</>}</p>}
      <button className="primary" onClick={next} disabled={pending}>{index + 1 >= session.queue.length ? "학습 마치기" : "다음 단어 ↗"}</button>
    </div> : <>
      <form className="study-answer" onSubmit={event => { event.preventDefault(); review("typed", answer); }}>
        <label htmlFor="answer">영어로 입력하기<input id="answer" value={answer} onChange={event => setAnswer(event.target.value)} autoComplete="off" autoFocus /></label>
        <div className="study-actions"><button className="primary" type="submit" disabled={pending || !answer.trim()}>확인하기</button><button type="button" onClick={() => setHint(true)} disabled={hint}>힌트</button></div>
      </form>
      <details><summary>객관식으로 풀기</summary><div className="study-actions">{options.map(option => <button type="button" key={option} onClick={() => review("choice", option)} disabled={pending}>{option}</button>)}</div></details>
      <details><summary>스스로 확인하고 기록하기</summary><div className="study-actions"><button type="button" onClick={() => selfRate("again")} disabled={pending}>다시 보기</button><button type="button" onClick={() => selfRate("good")} disabled={pending}>알고 있었어요</button></div></details>
    </>}
    {error && <p className="notice" role="alert">{error}</p>}
  </section>;
}
