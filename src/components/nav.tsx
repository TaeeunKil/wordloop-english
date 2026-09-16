"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "오늘", icon: "today" },
  { href: "/words", label: "단어장", icon: "words" },
  { href: "/stats", label: "기록", icon: "stats" },
] as const;

function NavIcon({ name }: { name: (typeof items)[number]["icon"] }) {
  if (name === "today") return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.75h14a1.25 1.25 0 0 1 1.25 1.25v13A1.25 1.25 0 0 1 19 20.25H5A1.25 1.25 0 0 1 3.75 19V6A1.25 1.25 0 0 1 5 4.75Z" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="M7.5 3.75v3M16.5 3.75v3M4.25 9h15.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M8 13h2M14 13h2M8 16.5h2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
  if (name === "words") return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.25 4.75h10.5A3 3 0 0 1 18.75 7.7v11.55a.5.5 0 0 1-.78.42l-2.36-1.57a2.25 2.25 0 0 0-2.49 0l-1.73 1.15-1.73-1.15a2.25 2.25 0 0 0-2.49 0L4.81 19.67a.5.5 0 0 1-.78-.42V6a1.25 1.25 0 0 1 1.25-1.25Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M7.5 8.5h7M7.5 12h5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.25V13M10 19.25V9M15.5 19.25V5M21 19.25V2.75" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M3.5 19.25h18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}

export function Nav() {
  const pathname = usePathname();
  const isStudy = pathname === "/study";
  return <nav className="workspace-nav" aria-label="주 메뉴" data-focus={isStudy ? "true" : "false"}>{items.map(({ href, label, icon }) => {
    const active = pathname === href || (href === "/dashboard" && isStudy);
    return <Link key={href} href={href} aria-current={active ? "page" : undefined} data-active={active ? "true" : "false"}><NavIcon name={icon} /><span>{label}</span></Link>;
  })}</nav>;
}
