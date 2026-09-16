import Link from "next/link";
import Image from "next/image";

export function Brand({ href = "/" }: { href?: string }) {
  return <Link href={href} className="logo" aria-label="WordLoop 홈"><Image className="logo-mark" src="/mark.svg" alt="" width={32} height={32} priority /><span className="logo-word">WordLoop<span aria-hidden="true">.</span></span></Link>;
}
export function PublicHeader() {
  return <header className="public-header"><Brand /><span className="eyebrow">A LITTLE, EVERY DAY</span></header>;
}
