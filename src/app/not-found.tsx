import Link from "next/link";
import { PublicHeader } from "@/components/brand";
export default function NotFound() {
  return <><PublicHeader /><main id="main" className="setup-page" tabIndex={-1}><p className="eyebrow">404 / PAGE NOT FOUND</p><h1>이 페이지는<br />찾을 수 없어요.</h1><p className="quiet">주소를 확인하거나 오늘의 학습으로 돌아가세요.</p><Link className="button primary" href="/dashboard">오늘의 학습으로 →</Link></main></>;
}
