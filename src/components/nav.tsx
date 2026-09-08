"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function Nav() {
  const pathname = usePathname();
  return <nav className="workspace-nav" aria-label="주 메뉴">{[["/dashboard", "오늘"], ["/words", "단어장"], ["/stats", "기록"]].map(([href, label]) =>
    <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} data-active={pathname === href || (href === "/dashboard" && pathname === "/study")}>{label}</Link>)}</nav>;
}
