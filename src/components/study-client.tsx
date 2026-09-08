"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { finishStudy, startStudy, submitReview } from "@/app/actions";
import type { Receipt, ReviewInput, StudyItem } from "@/lib/types";
import { choiceOptions } from "@/lib/validation";
import { reviewDate } from "@/lib/calendar";

type Session = { id: string; queue: StudyItem[]; alternatives: string[] };
export function StudyClient({ timeZone }: { timeZone: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Receipt | null>(null);
  // Retain the entire request after a transport failure: a retry must use the same id.
  const [request, setRequest] = useState<ReviewInput | null>(null);
  const [completed, setCompleted] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const finishRef = useRef<HTMLHeadingElement>(null);
  const item = session?.queue[index];

  useEffect(() => {
    if (pending) return;
    if (completed !== null) finishRef.current?.focus();
    else if (feedback) nextRef.current?.focus();
    else if (item) inputRef.current?.focus();
  }, [index, item, feedback, completed, pending]);

  function begin() {
    if (pending) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await startStudy();
        if (result.error || !result.data) setError(result.error ?? "학습 목록을 불러오지 못했습니다.");
        else {
          const data = result.data;
          setSession({ id: data.sessionId, queue: data.queue, alternatives: data.alternatives });
          setIndex(0); setAnswer(""); setHint(false); setFeedback(null); setRequest(null); setCompleted(null);
          setOptions(data.queue[0] ? choiceOptions(data.queue[0].term, data.alternatives) : []);
        }
      } catch { setError("학습 목록을 불러오지 못했습니다. 연결을 확인하고 다시 시작해 주세요."); }
    });
  }

  function send(payload: ReviewInput) {
    if (pending) return;
    setError(""); setRequest(payload);
    startTransition(async () => {
      try {
        const result = await submitReview(payload);
        if (result.error || !result.data) setError(result.error ?? "응답을 저장하지 못했습니다.");
        else { setFeedback(result.data); setRequest(null); }
      } catch { setError("저장 여부를 확인하지 못했습니다. 연결을 확인한 뒤 같은 응답을 재시도하세요."); }
    });
  }

  function review(mode: "typed" | "choice" | "self", selected: string, rating: "good" | "again" | null = null) {
    if (!session || !item || feedback || pending || request) return;
    if (mode !== "self" && !selected.trim()) return;
    setAnswer(selected);
    send({
      id: crypto.randomUUID(), session_id: session.id, word_id: item.id,
      word_version: item.version, state_version: item.state_version,
      mode, answer: selected, hint_used: mode === "self" ? false : hint, rating,
    });
  }

  function next() {
    if (!session || pending) return;
    setError("");
    if (!item || index + 1 >= session.queue.length) {
      startTransition(async () => {
        try {
          const result = await finishStudy(session.id);
          if (result.error || !result.data) setError(result.error ?? "학습을 마치지 못했습니다. 다시 시도하세요.");
          else { setCompleted(session.queue.length); setSession(null); setFeedback(null); setRequest(null); }
        } catch { setError("학습 종료를 확인하지 못했습니다. 저장된 응답은 유지됩니다. 다시 마치기를 눌러 주세요."); }
      });
      return;
    }
    const following = session.queue[index + 1];
    setIndex(value => value + 1); setAnswer(""); setHint(false); setFeedback(null); setRequest(null);
    setOptions(choiceOptions(following.term, session.alternatives));
  }

  const errorMessage = error && <div className="notice error-notice" role="alert"><p>{error}</p>
    {request && <div className="actions"><button onClick={() => send(request)} disabled={pending}>같은 응답 재시도</button><button onClick={begin} disabled={pending}>현재 학습 상태 불러오기</button></div>}
  </div>;

  if (completed !== null) return <section className="study-intro">
    <p className="eyebrow">SESSION COMPLETE</p><h2 ref={finishRef} tabIndex={-1}>{completed ? "오늘의 반복을 남겼어요." : "지금 복습할 단어가 없어요."}</h2>
    <p className="quiet">{completed ? `${completed}개의 응답을 저장했습니다. 다음 복습 시간에 다시 만나요.` : "새 단어를 추가하거나 복습할 시간이 되면 다시 시작하세요."}</p>
    <div className="actions"><Link className="button primary" href={completed ? "/stats" : "/words"}>{completed ? "학습 기록 보기" : "단어장 열기"} →</Link><button onClick={begin} disabled={pending}>{pending ? "불러오는 중…" : "남은 단어 확인"}</button></div>
    {errorMessage}
  </section>;

  if (!session) return <section className="study-intro">
    <p className="eyebrow">READY WHEN YOU ARE</p><h2>한 단어에,<br />잠깐 집중해 볼까요?</h2>
    <p className="lead quiet">뜻을 보고 영어 표현을 떠올려 보세요.<br />복습할 단어와 새 단어를 최대 20개씩 준비합니다.</p>
    <button className="primary" onClick={begin} disabled={pending}>{pending ? "학습 준비 중…" : "학습 시작하기 →"}</button>
    <p className="small quiet">Enter로 제출 · 막히면 힌트 · 응답마다 기록</p>{errorMessage}
  </section>;

  if (!item) return <section className="study-intro"><p className="eyebrow">ALL CAUGHT UP</p><h2>지금은 복습할 단어가 없어요.</h2><p className="quiet">세션을 마치고 새로운 표현을 추가해 보세요.</p><button className="primary" onClick={next} disabled={pending}>{pending ? "마치는 중…" : "세션 마치기"}</button>{errorMessage}</section>;

  const locked = pending || Boolean(request);
  return <section className="study-workspace" aria-busy={pending}>
    <div className="study-progress"><span>단어 {String(index + 1).padStart(2, "0")} <span className="quiet">/ {String(session.queue.length).padStart(2, "0")}</span></span><span className="small quiet">{item.due_at ? `복습 단계 ${item.stage}` : "처음 만나는 단어"}</span></div>
    <progress value={index + (feedback ? 1 : 0)} max={session.queue.length} aria-label="이번 학습에서 저장한 응답" />
    <div className="study-prompt"><p className="eyebrow">이 뜻의 영어 표현은?</p><h2>{item.meaning}</h2></div>
    {hint && !feedback && <aside className="hint-content" aria-label="단어 힌트"><p>첫 글자 <strong lang="en">{item.term.slice(0, 1)}</strong> · {item.term.length}글자</p>{item.example && <p lang="en">{item.example}</p>}<span className="small quiet">힌트 사용 응답으로 기록됩니다.</span></aside>}
    {feedback ? <div className={`study-feedback ${feedback.correct === false ? "wrong" : feedback.correct === null ? "self-rated" : "correct"}`} key={feedback.id}>
      <div role="status"><p className="feedback-label">{feedback.correct === null ? "스스로 확인한 응답을 기록했어요" : feedback.correct ? "정답이에요" : "이 표현을 다시 기억해 주세요"}</p>
        <h3 lang="en">{feedback.expected_answer}</h3>
        {feedback.correct === false && <p className="quiet">내 답: <span lang="en">{answer}</span></p>}
        <p>다음 복습 <time dateTime={feedback.due_at}>{reviewDate(feedback.due_at, timeZone)}</time></p>
        {item.example && <p className="quiet" lang="en">{item.example}</p>}
      </div>
      <button className="primary" ref={nextRef} onClick={next} disabled={pending}>{pending ? "마치는 중…" : index + 1 >= session.queue.length ? "학습 마치기 →" : "다음 단어 →"}</button>
    </div> : <>
      <form className="study-answer" onSubmit={event => { event.preventDefault(); review("typed", answer); }}>
        <label htmlFor="answer">영어로 입력하기<input ref={inputRef} id="answer" name="answer" value={answer} onChange={event => setAnswer(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={2000} disabled={locked} aria-describedby="answer-help" /></label>
        <div className="study-actions"><button className="primary" type="submit" disabled={locked || !answer.trim()}>{pending ? "응답 저장 중…" : "정답 확인"}</button><button type="button" onClick={() => setHint(true)} disabled={locked || hint} aria-expanded={hint}>{hint ? "힌트 사용 중" : "힌트 보기"}</button><span id="answer-help" className="small quiet">{request ? "저장 상태를 먼저 확인해 주세요." : "영어 표현을 입력한 뒤 Enter"}</span></div>
      </form>
      <div className="study-alternatives" key={item.id}>
        <details onToggle={event => { if (event.currentTarget.open) setHint(true); }}><summary>객관식으로 풀기 <span className="small quiet">도움을 받은 응답으로 기록</span></summary><div className="choice-options">{options.map((option, i) => <button type="button" key={option} onClick={() => review("choice", option)} disabled={locked}><span className="option-number" aria-hidden="true">{i + 1}</span><span lang="en">{option}</span></button>)}</div></details>
        <details onToggle={event => { if (event.currentTarget.open) setHint(true); }}><summary>정답을 보고 스스로 확인하기</summary><p className="self-answer" lang="en">{item.term}</p><p className="small quiet">스스로 확인한 응답은 직접 입력 정답률에 포함되지 않습니다.</p><div className="actions"><button type="button" onClick={() => review("self", "", "again")} disabled={locked}>다시 보기</button><button type="button" onClick={() => review("self", "", "good")} disabled={locked}>알고 있었어요</button></div></details>
      </div>
    </>}
    {errorMessage}
    {pending && <p className="small quiet" role="status">서버에 기록을 저장하고 있습니다.</p>}
  </section>;
}
