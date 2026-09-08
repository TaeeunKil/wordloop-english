"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveWord, saveWord } from "@/app/actions";
import type { Word } from "@/lib/types";
export function WordEditor({ word }: { word?: Word }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function toggleArchive() {
    startTransition(async () => {
      try {
        const result = await archiveWord(word!.id, word!.version, !word!.archived);
        if (result.error) setError(result.error); else { setError(""); router.refresh(); }
      } catch { setError("변경하지 못했습니다. 연결 상태를 확인하세요."); }
    });
  }
  return <div className={word ? "word-editor" : "add-word"}>
    <div className="actions"><button className={word ? "" : "primary"} onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "닫기" : word ? "수정" : "+ 단어 추가"}</button>
    {word && <button disabled={pending} onClick={toggleArchive}>{pending ? "저장 중…" : word.archived ? "복원" : "보관"}</button>}</div>
    {open && <form className="editor-form" action={(form) => startTransition(async () => {
      setError("");
      try {
        const result = await saveWord(Object.fromEntries(form), word?.id, word?.version);
        if (result.error) setError(result.error); else { setOpen(false); router.refresh(); }
      } catch { setError("저장하지 못했습니다. 입력 내용은 그대로 두었습니다. 다시 시도하세요."); }
    })}><fieldset disabled={pending}><legend>{word ? "단어 수정" : "새 단어"}</legend>
      <label>영어 단어 또는 표현<input name="term" required maxLength={200} defaultValue={word?.term} autoComplete="off" /></label>
      <label>뜻<textarea name="meaning" required maxLength={2000} defaultValue={word?.meaning} /></label>
      <label>예문<input name="example" maxLength={3000} defaultValue={word?.example} /></label>
      <label>메모<textarea name="note" maxLength={3000} defaultValue={word?.note} /></label>
      <button className="primary">{pending ? "저장 중…" : "저장하기"}</button>
    </fieldset></form>}
    {error && <p className="notice" role="alert">{error}</p>}
  </div>;
}
