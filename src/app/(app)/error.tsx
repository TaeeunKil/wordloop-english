"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="empty" role="alert"><h1>기록을 불러오지 못했습니다.</h1><p>연결 상태와 Supabase 설정을 확인한 뒤 다시 시도하세요.</p><button onClick={reset}>다시 불러오기</button></section>;
}
