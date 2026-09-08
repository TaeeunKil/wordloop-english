import Link from "next/link";
import { getConfig } from "@/lib/env";
import { PublicHeader } from "@/components/brand";
import { SubmitButton } from "@/components/submit-button";
import { GitHubIcon, GoogleIcon } from "@/components/social-icons";
import { login, loginWithGoogle } from "./actions";

export default async function Landing({ searchParams }: { searchParams: Promise<{ auth?: string }> }) {
  const { auth } = await searchParams;
  const configured = Boolean(getConfig());
  return <><PublicHeader /><main id="main" className="landing" tabIndex={-1}>
    <section className="hero" aria-labelledby="brand-title"><div className="hero-inner">
      <p className="eyebrow">나만의 단어, 매일의 기록</p>
      <h1 id="brand-title">WordLoop<span className="accent">.</span></h1>
      <div className="hero-copy"><h2>모아둔 단어를,<br />내가 쓰는 영어로.</h2><div className="hero-start">
        <p className="lead">기억하고 싶은 표현을 적고, 뜻을 보며 떠올리고.<br className="desktop-break" /> 오늘의 작은 반복을 나만의 기록으로 남기세요.</p>
        {auth && <p role="alert" className="notice error-notice">{auth === "required" ? "학습 기록을 이어가려면 Google 또는 GitHub로 로그인하세요." : auth === "logout-failed" ? "로그아웃하지 못했습니다. 연결을 확인하고 학습 화면에서 다시 시도하세요." : "로그인을 완료하지 못했습니다. 아래에서 다시 시작해 주세요."}</p>}
        {configured ? <div className="auth-actions">
          <form action={loginWithGoogle}><SubmitButton><span className="auth-label"><GoogleIcon /><span>Google로 시작하기</span></span><span aria-hidden="true">↗</span></SubmitButton></form>
          <form action={login}><SubmitButton><span className="auth-label"><GitHubIcon /><span>GitHub로 시작하기</span></span><span aria-hidden="true">↗</span></SubmitButton></form>
        </div> : <Link className="button primary" href="/setup">연결 설정 안내 <span aria-hidden="true">↗</span></Link>}
        <Link className="text-link" href="/dashboard">내 학습으로 이동 <span aria-hidden="true">→</span></Link>
      </div></div>
      <div className="hero-baseline" aria-hidden="true"><span>COLLECT / RECALL / RETURN</span><span>한 단어씩, 내 속도로.</span></div>
    </div></section>
    <section className="principles" aria-label="학습 흐름">
      <article><span className="eyebrow">01 / COLLECT</span><h2>내게 필요한 단어만.</h2><p>책에서, 대화에서 만난 표현을 뜻과 예문으로 정리하세요.</p></article>
      <article><span className="eyebrow">02 / RECALL</span><h2>뜻을 보고, 떠올리기.</h2><p>한 번에 한 단어. 직접 입력하고 막히면 힌트를 열어보세요.</p></article>
      <article><span className="eyebrow">03 / RETURN</span><h2>다시 만날 때까지.</h2><p>응답에 맞춰 복습할 시간을 정하고, 매일의 학습을 기록합니다.</p></article>
    </section>
    <section className="closing"><div><p className="eyebrow">YOUR OWN WORDS</p><h2>오늘 기억할 단어가 있나요?</h2></div><Link href={configured ? "/dashboard" : "/setup"} className="button">나의 단어장 시작하기 <span aria-hidden="true">→</span></Link></section>
  </main></>;
}
