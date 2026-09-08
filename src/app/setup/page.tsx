import Link from "next/link";
import { PublicHeader } from "@/components/brand";
export default function Setup() {
  return <><PublicHeader /><main id="main" className="setup-page" tabIndex={-1}><p className="eyebrow">WORKSPACE / SETUP</p><h1>학습 공간을<br />준비하고 있어요.</h1>
    <p className="lead quiet">아직 로그인과 기록 저장을 사용할 수 없습니다.<br />연결이 준비되면 단어장을 시작할 수 있어요.</p>
    <Link href="/" className="button primary">처음으로 돌아가기 →</Link>
    <details className="setup-details"><summary>운영자를 위한 연결 안내</summary>
      <ol className="setup-list"><li><strong>데이터베이스 준비</strong><p>Supabase 프로젝트에 저장소의 migration을 적용합니다.</p></li><li><strong>로그인 연결</strong><p>Google과 GitHub 로그인을 활성화하고 callback URL을 등록합니다.</p></li><li><strong>환경변수 등록 후 빌드</strong><p>배포 환경에 아래 값을 설정합니다.</p></li></ol>
      <pre>NEXT_PUBLIC_SUPABASE_URL{"\n"}NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY{"\n"}NEXT_PUBLIC_SITE_URL</pre>
      <p className="small quiet">공개용 publishable key를 사용하세요. 자세한 절차는 저장소의 README와 docs/runbook/supabase-setup.md에 있습니다.</p>
    </details>
  </main></>;
}
