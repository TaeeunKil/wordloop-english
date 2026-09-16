import { requireUser } from "@/lib/supabase/server";
import { logout } from "@/app/actions";
import { Nav } from "@/components/nav";
import { Brand } from "@/components/brand";
import { SubmitButton } from "@/components/submit-button";
import { AccountMenu } from "@/components/account-menu";
export const dynamic = "force-dynamic";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="app-shell"><header className="app-toolbar"><Brand href="/dashboard" /><Nav /><form className="desktop-logout" action={logout}><SubmitButton className="link-button" pendingLabel="로그아웃 중…">로그아웃</SubmitButton></form><AccountMenu /></header><main id="main" className="workspace" tabIndex={-1}>{children}</main></div>;
}
