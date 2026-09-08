import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return <Link href={href} className="logo" aria-label="WordLoop 홈">WordLoop<span aria-hidden="true">.</span></Link>;
}
export function PublicHeader() {
  return <header className="public-header"><Brand /><span className="eyebrow">A LITTLE, EVERY DAY</span></header>;
}
