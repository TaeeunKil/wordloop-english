import Link from "next/link";
export default function Setup() {
  return <main id="main" className="narrow"><p className="eyebrow">CONNECTION REQUIRED</p><h1>학습 공간을<br />연결해 주세요.</h1>
    <p className="lead">아직 로그인·데이터베이스 연결이 준비되지 않았습니다.</p>
    <ol className="setup-list"><li>Supabase 프로젝트에 저장소의 migration을 적용하세요.</li><li>Supabase Auth에서 Google과 GitHub 로그인을 활성화하고 callback URL을 등록하세요.</li><li>배포 환경에 아래 세 환경변수를 설정하고 다시 빌드하세요.</li></ol>
    <pre>NEXT_PUBLIC_SUPABASE_URL{"\n"}NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY{"\n"}NEXT_PUBLIC_SITE_URL</pre>
    <p className="quiet">프로젝트의 공개용 publishable key만 사용하세요. 자세한 절차는 저장소 README와 docs/runbook/supabase-setup.md에 있습니다.</p>
    <Link href="/" className="button">홈으로 돌아가기</Link></main>;
}
