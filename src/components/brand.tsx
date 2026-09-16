import Link from "next/link";
import Image from "next/image";

export function Brand({ href = "/" }: { href?: string }) {
  return <Link href={href} className="logo" aria-label="WordLoop 홈">
    <Image className="logo-image" src="/logo.svg" alt="" aria-hidden="true" width={194} height={44} unoptimized priority />
  </Link>;
}
export function PublicHeader() {
  return <header className="public-header"><Brand /><span className="eyebrow">A LITTLE, EVERY DAY</span></header>;
}
