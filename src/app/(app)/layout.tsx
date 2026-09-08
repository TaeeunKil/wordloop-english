import { requireUser } from "@/lib/supabase/server";
import { logout } from "@/app/actions";
import { Nav } from "@/components/nav";
export const dynamic = "force-dynamic";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="app-shell"><div className="app-toolbar"><Nav /><form action={logout}><button className="link-button">로그아웃</button></form></div><main id="main">{children}</main></div>;
}
