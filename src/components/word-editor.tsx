"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { archiveWord, saveWord } from "@/app/actions";
import { reviewDate } from "@/lib/calendar";
import type { Word } from "@/lib/types";

type ReviewState = { word_id: string; last_reviewed_at: string | null; due_at: string; mastery_score: number; reviews: number };

function masteryLabel(state?: ReviewState) {
  if (!state || state.reviews === 0) return "아직 평가 전";
  if (state.mastery_score >= 85) return "안정적으로 기억 중";
  if (state.mastery_score >= 60) return "기억이 자리 잡는 중";
  if (state.mastery_score >= 30) return "익숙해지는 중";
  return "아직 익숙하지 않음";
}

function masteryDots(score: number) {
  const filled = Math.round(Math.max(0, Math.min(100, score)) / 100 * 20);
  return Array.from({ length: 20 }, (_, index) => <span
    key={index}
    className={`mastery-dot ${index < filled ? "is-filled" : ""}`}
    aria-hidden="true"
    style={{ "--dot-delay": `${index * 18}ms` } as CSSProperties}
  />);
}
export function WordLibrary({ words, states, timeZone, total, query, archived }: {
  words: Word[]; states: ReviewState[]; timeZone: string; total: number; query: string; archived: boolean;
}) {
  const [editing, setEditing] = useState<Word | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (editing !== undefined && !dialog.current?.open) dialog.current?.showModal();
  }, [editing]);
  useEffect(() => {
    if (!pending && editing === undefined && trigger.current) {
      trigger.current.focus();
      trigger.current = null;
    }
  }, [pending, editing]);
  function open(word: Word | null, source: HTMLElement) {
    trigger.current = source;
    setError(""); setNotice(""); setEditing(word);
  }
  function close() {
    dialog.current?.close();
    setEditing(undefined); setError("");
    trigger.current?.focus();
  }
  function toggleArchive(word: Word) {
    setError(""); setNotice("");
    startTransition(async () => {
      try {
        const result = await archiveWord(word.id, word.version, !word.archived);
        if (result.error) setError(result.error);
        else { setNotice(word.archived ? "단어를 학습 목록으로 복원했습니다." : "단어를 보관했습니다. 보관함에서 다시 복원할 수 있습니다."); router.refresh(); }
      } catch { setError("변경하지 못했습니다. 연결 상태를 확인하고 다시 시도하세요."); }
    });
  }
  return <>
    <div className="library-toolbar"><nav className="library-tabs" aria-label="단어 상태"><Link href={"/words?" + new URLSearchParams({ q: query })} aria-current={!archived ? "page" : undefined}>학습 중</Link><Link href={"/words?" + new URLSearchParams({ q: query, archived: "true" })} aria-current={archived ? "page" : undefined}>보관함</Link></nav><button className="primary" onClick={event => open(null, event.currentTarget)} disabled={pending}>+ 단어 추가</button></div>
    <form className="filters" action="/words"><input type="hidden" name="archived" value={String(archived)} />
      <label htmlFor="word-search">단어·뜻 검색<input key={query} id="word-search" name="q" defaultValue={query} maxLength={200} placeholder="기억하고 싶은 표현 찾기" type="search" /></label><button type="submit">검색</button>
      {query && <Link className="text-link" href={archived ? "/words?archived=true" : "/words"}>검색 초기화</Link>}
    </form>
    <div className="list-caption"><span>{archived ? "보관한 단어" : "학습 중인 단어"} · {total}개{query && " 검색됨"}</span><span>최근 추가순</span></div>
    <p className="sr-only" role="status">{pending ? "변경 사항을 저장하는 중입니다." : notice}</p>
    {notice && <p className="notice success-notice">{notice}</p>}
    {error && editing === undefined && <p className="notice error-notice" role="alert">{error}</p>}
    <div className="word-list">{words.length ? words.map(word => {
      const state = states.find(state => state.word_id === word.id);
      return <article className="word-row" key={word.id}>
        <div className="word-copy"><h2 lang="en">{word.term}</h2><p>{word.meaning}</p>
          {(word.example || word.example_meaning || word.note) && <details className="word-context"><summary aria-label={word.term + " 예문과 메모"}>예문·메모</summary>{word.example && <p lang="en">{word.example}</p>}{word.example_meaning && <p>{word.example_meaning}</p>}{word.note && <p className="quiet">{word.note}</p>}</details>}
        </div>
        <div className="word-meta">
          <div className="word-mastery"><div className="mastery-heading"><span>단어 숙련도</span><strong>{state?.reviews ? `${state.mastery_score}/100` : "평가 전"}</strong></div><div className="mastery-dot-bar" role="progressbar" aria-label={`${word.term} 단어 숙련도`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={state?.reviews ? state.mastery_score : 0} aria-valuetext={state?.reviews ? `${state.mastery_score}/100 · ${masteryLabel(state)}` : "평가 전"}>{masteryDots(state?.reviews ? state.mastery_score : 0)}</div><p className="small quiet">{masteryLabel(state)}</p></div>
          <dl className="word-dates"><div><dt>마지막 복습</dt><dd>{state?.last_reviewed_at ? <time dateTime={state.last_reviewed_at}>{reviewDate(state.last_reviewed_at, timeZone)}</time> : "아직 학습 전"}</dd></div><div><dt>다음 복습</dt><dd>{archived ? "보관 중 · 학습 제외" : state?.due_at ? <time dateTime={state.due_at}>{reviewDate(state.due_at, timeZone)}</time> : "첫 학습 대기"}</dd></div></dl>
        </div>
        <div className="row-actions"><button onClick={event => open(word, event.currentTarget)} aria-label={word.term + " 수정"} disabled={pending}>수정</button><button className="link-button" onClick={() => toggleArchive(word)} aria-label={word.term + (word.archived ? " 복원" : " 보관")} disabled={pending}>{word.archived ? "복원" : "보관"}</button></div>
      </article>;
    }) : <div className="empty"><p className="eyebrow">YOUR WORDS, YOUR PACE</p><h2>{query ? "일치하는 단어가 없어요." : archived ? "보관함이 비어 있어요." : "첫 단어를 남겨보세요."}</h2>
      <p>{query ? "다른 단어나 뜻으로 검색해 보세요." : archived ? "잠시 학습을 쉬고 싶은 단어는 보관해 둘 수 있습니다." : "영어 표현과 뜻만 있으면 학습을 시작할 수 있어요."}</p>
      {!query && !archived && <button onClick={event => open(null, event.currentTarget)}>첫 단어 추가</button>}
    </div>}</div>
    {editing !== undefined && <dialog ref={dialog} className="editor-dialog" aria-labelledby="editor-title" aria-describedby="editor-description"
      onCancel={event => { event.preventDefault(); if (!pending) close(); }} onClose={() => { if (editing !== undefined) setEditing(undefined); }}>
      <div className="dialog-heading"><div><p className="eyebrow">{editing ? "EDIT WORD" : "NEW WORD"}</p><h2 id="editor-title">{editing ? "단어 다듬기" : "새 단어 담기"}</h2></div><button type="button" className="link-button" aria-label="단어 편집 닫기" onClick={close} disabled={pending}>닫기 ×</button></div>
      <p id="editor-description" className="quiet">단어와 뜻은 필수입니다. 예문 뜻은 문장 전체 의미를 적어두면 좋아요.</p>
      <form onSubmit={event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));
        setError("");
        startTransition(async () => {
          try {
            const result = await saveWord(values, editing?.id, editing?.version);
            if (result.error) setError(result.error);
            else { close(); setNotice(editing ? "단어를 수정했습니다." : "새 단어를 추가했습니다."); router.refresh(); }
          } catch { setError("저장하지 못했습니다. 입력 내용은 그대로 두었습니다. 연결을 확인하고 다시 저장하세요."); }
        });
      }} aria-busy={pending}>
        <fieldset disabled={pending}><legend className="sr-only">단어 내용</legend>
          <label htmlFor="edit-term">영어 단어 또는 표현 <span aria-hidden="true">*</span><input id="edit-term" name="term" required maxLength={200} defaultValue={editing?.term} autoComplete="off" autoCapitalize="none" spellCheck={false} autoFocus /></label>
          <label htmlFor="edit-meaning">뜻 <span aria-hidden="true">*</span><textarea id="edit-meaning" name="meaning" required maxLength={2000} defaultValue={editing?.meaning} rows={2} /></label>
          <label htmlFor="edit-example">예문 <span className="optional">선택</span><textarea id="edit-example" name="example" maxLength={3000} defaultValue={editing?.example} rows={2} /></label>
          <label htmlFor="edit-example-meaning">예문 뜻 <span className="optional">선택</span><textarea id="edit-example-meaning" name="example_meaning" maxLength={3000} defaultValue={editing?.example_meaning} rows={2} /></label>
          <label htmlFor="edit-note">메모 <span className="optional">선택</span><textarea id="edit-note" name="note" maxLength={3000} defaultValue={editing?.note} rows={2} /></label>
          {error && <p id="editor-error" className="notice error-notice" role="alert">{error}</p>}
          <div className="dialog-actions"><button type="button" onClick={close}>취소</button><button className="primary" type="submit">{pending ? "저장 중…" : "저장하기"}</button></div>
        </fieldset>
        {pending && <p role="status" className="small quiet">저장하고 있습니다. 잠시 기다려 주세요.</p>}
      </form>
    </dialog>}
  </>;
}
