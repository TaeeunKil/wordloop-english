import { logout } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function AccountMenu() {
  return <details className="account-menu">
    <summary className="menu-trigger" aria-label="내 메뉴">
      <span className="menu-icon" aria-hidden="true"><span /><span /><span /></span>
      <span className="sr-only">내 메뉴</span>
    </summary>
    <div className="account-menu-panel">
      <p className="small quiet">내 학습 공간</p>
      <form action={logout}><SubmitButton className="menu-action" pendingLabel="로그아웃 중…">로그아웃</SubmitButton></form>
    </div>
  </details>;
}
