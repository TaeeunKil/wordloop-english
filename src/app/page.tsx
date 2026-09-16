import Link from "next/link";
import { getConfig } from "@/lib/env";
import { PublicHeader } from "@/components/brand";
import { SubmitButton } from "@/components/submit-button";
import { GitHubIcon, GoogleIcon } from "@/components/social-icons";
import { LandingDemo } from "@/components/landing-demo";
import { login, loginWithGoogle } from "./actions";

export default async function Landing({ searchParams }: { searchParams: Promise<{ auth?: string }> }) {
  const { auth } = await searchParams;
  const configured = Boolean(getConfig());
  return <><PublicHeader /><main id="main" className="landing" tabIndex={-1}>
    <section className="landing-hero" aria-labelledby="brand-title"><div className="landing-hero-inner">
      <div className="landing-intro"><p className="eyebrow">나만의 단어, 매일의 기록</p><h1 id="brand-title">모아둔 단어를,<br />내가 쓰는 영어로<span className="accent">.</span></h1>
        <p className="lead">기억하고 싶은 표현을 한 문장 안에서 떠올리고,<br className="desktop-break" /> 오늘의 작은 반복을 나만의 기록으로 남기세요.</p>
        {auth && <p role="alert" className="notice error-notice">{auth === "required" ? "학습 기록을 이어가려면 Google 또는 GitHub로 로그인하세요." : auth === "logout-failed" ? "로그아웃하지 못했습니다. 연결을 확인하고 학습 화면에서 다시 시도하세요." : "로그인을 완료하지 못했습니다. 아래에서 다시 시작해 주세요."}</p>}
        {configured ? <div className="auth-actions"><form action={loginWithGoogle}><SubmitButton><span className="auth-label"><GoogleIcon /><span>Google로 시작하기</span></span><span aria-hidden="true">↗</span></SubmitButton></form><form action={login}><SubmitButton><span className="auth-label"><GitHubIcon /><span>GitHub로 시작하기</span></span><span aria-hidden="true">↗</span></SubmitButton></form></div> : <Link className="button primary" href="/setup">연결 설정 안내 <span aria-hidden="true">↗</span></Link>}
        <p className="small quiet landing-auth-note">로그인하면 단어와 학습 기록이 안전하게 저장됩니다.</p>
      </div>
      <LandingDemo />
    </div><div className="landing-baseline" aria-hidden="true"><span>RECALL / REPEAT / REMEMBER</span><span>한 문장씩, 내 속도로.</span></div></section>
  </main></>;
}
