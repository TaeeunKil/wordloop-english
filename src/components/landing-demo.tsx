"use client";

import { FormEvent, useState } from "react";

const answer = "evaluate";

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function LandingDemo() {
  const [value, setValue] = useState("");
  const [hint, setHint] = useState(false);
  const [result, setResult] = useState<boolean | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (value.trim()) setResult(normalize(value) === answer);
  }

  function reset() {
    setValue("");
    setHint(false);
    setResult(null);
  }

  return <section className="landing-demo" aria-labelledby="landing-demo-title">
    <div className="landing-demo-heading"><div><p className="eyebrow">A QUICK TRY</p><h2 id="landing-demo-title">한 문장으로<br />기억해 보세요.</h2></div><span className="small quiet">미리보기</span></div>
    <form onSubmit={submit}>
      <div className="landing-demo-question">
        <p className="small quiet">문장의 빈칸을 채워 보세요</p>
        <p className="landing-demo-sentence" lang="en">The committee will {result === null ? <input className="landing-demo-input" aria-label="빈칸에 들어갈 표현" value={value} onChange={event => setValue(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} /> : <span className={`landing-demo-answer ${result ? "is-correct" : "is-wrong"}`}>{answer}</span>} each proposal carefully.</p>
        <p className="landing-demo-translation"><span className="small quiet">문장 뜻</span> 위원회는 각 제안을 신중하게 평가할 것입니다.</p>
      </div>
      {result !== null ? <div className={`landing-demo-feedback ${result ? "is-correct" : "is-wrong"}`} role="status" aria-live="polite">
        <div><p className="feedback-label">{result ? "정답이에요" : "아직 익숙하지 않은 표현이에요"}</p><p className="small quiet">정답 <strong lang="en">{answer}</strong> · 평가하다</p></div>
        <button type="button" onClick={reset}>다시 해보기</button>
      </div> : <div className="landing-demo-actions"><button className="primary" type="submit" disabled={!value.trim()}>정답 확인 <span aria-hidden="true">→</span></button><button type="button" onClick={() => setHint(true)} disabled={hint}>{hint ? "힌트 사용 중" : "힌트 보기"}</button></div>}
      {hint && result === null && <aside className="landing-demo-hint"><span className="small quiet">뜻</span> 평가하다 <span className="small quiet">· e로 시작하는 8글자</span></aside>}
    </form>
    <p className="landing-demo-note small quiet">체험 결과는 저장되지 않아요. 로그인하면 나만의 단어와 학습 기록을 이어갈 수 있습니다.</p>
  </section>;
}
