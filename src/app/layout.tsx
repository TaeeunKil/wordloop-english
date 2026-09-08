import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = { title: { default: "WordLoop — 나의 영어 단어장", template: "%s · WordLoop" }, description: "직접 떠올리고, 다시 만나고. 기기 사이에 이어지는 나의 영어 학습." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><a className="skip-link" href="#main">본문으로 건너뛰기</a>
    <header className="site-header"><Link href="/" className="logo" aria-label="WordLoop 홈">WordLoop<span>®</span></Link><span className="eyebrow">A little, every day.</span></header>
    {children}
    <footer><span>WordLoop · 나의 영어 학습 기록</span><span>Recall. Repeat. Remember.</span></footer>
  </body></html>;
}
