"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="error-page" role="alert"><p className="eyebrow">CONNECTION INTERRUPTED</p><h1>기록을 불러오지 못했어요.</h1><p className="quiet">인터넷 연결을 확인하고 다시 불러와 주세요. 계속 실패하면 다시 로그인해 주세요.</p><div className="actions"><button className="primary" onClick={reset}>다시 불러오기</button><Link className="button" href="/?auth=required">로그인 화면으로</Link></div></section>;
}
