import Link from "next/link";
import { getConfig } from "@/lib/env";
import { login, loginWithGoogle } from "./actions";
export default async function Landing({ searchParams }: { searchParams: Promise<{ auth?: string }> }) {
  const { auth } = await searchParams;
  const configured = Boolean(getConfig());
  return <main id="main" className="landing">
    <section className="hero"><p className="eyebrow">YOUR PERSONAL ENGLISH PRACTICE</p>
      <h1>WordLoop<span className="accent">.</span></h1>
      <div className="hero-bottom"><div><h2>떠올리는 순간,<br />내 단어가 됩니다.</h2><p className="quiet">나만의 단어를 모으고, 한 번 더 떠올리세요.<br />어느 기기에서든 이어지는 매일의 영어.</p>
        {auth && <p role="alert" className="notice">{auth === "required" ? "계속하려면 Google 또는 GitHub로 로그인하세요." : auth === "logout-failed" ? "로그아웃하지 못했습니다. 연결을 확인하고 다시 시도하세요." : "로그인을 완료하지 못했습니다. Google 또는 GitHub 연결 설정을 확인하고 다시 시도하세요."}</p>}
        {configured ? <div className="auth-actions"><form action={login}><button className="primary">GitHub로 시작하기 <span aria-hidden="true">↗</span></button></form><form action={loginWithGoogle}><button type="submit">Google로 시작하기 <span aria-hidden="true">↗</span></button></form></div>
          : <Link className="button primary" href="/setup">연결 설정 안내 <span aria-hidden="true">↗</span></Link>}
        <Link className="text-link" href="/dashboard">내 학습으로 이동 →</Link>
      </div><div className="loop-art" aria-hidden="true"><span>re</span><span>call<span className="accent">↗</span></span><small>01 — 기억은 반복에서</small></div></div>
    </section>
    <section className="principles" aria-label="학습 흐름"><article><span className="eyebrow">01 / COLLECT</span><h3>내게 필요한 단어</h3><p>뜻과 예문을 함께 남겨 나만의 단어장을 만드세요.</p></article><article><span className="eyebrow">02 / RECALL</span><h3>먼저 떠올리기</h3><p>뜻을 보고 직접 입력하세요. 막히면 힌트로 이어가세요.</p></article><article><span className="eyebrow">03 / RETURN</span><h3>다시 만날 시간</h3><p>응답마다 기록하고, 복습할 때 다시 꺼내 드립니다.</p></article></section>
    <section className="closing"><h2>오늘의 한 단어부터.</h2><Link href={configured ? "/dashboard" : "/setup"} className="text-link">학습 준비하기 →</Link></section>
  </main>;
}
