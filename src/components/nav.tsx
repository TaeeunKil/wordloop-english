"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function Nav() {
  const pathname = usePathname();
  return <nav className="workspace-nav" aria-label="주 메뉴">{[["/dashboard", "대시보드"], ["/words", "단어장"], ["/study", "학습"], ["/stats", "통계"]].map(([href, label]) =>
    <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}</nav>;
}
