import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "WordLoop — 나의 영어 단어장", template: "%s · WordLoop" }, description: "직접 떠올리고, 다시 만나고. 기기 사이에 이어지는 나의 영어 학습." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><a className="skip-link" href="#main">본문으로 건너뛰기</a>
    {children}
    <footer className="site-footer"><span>WordLoop · 나의 영어 학습 기록</span><span lang="en">Recall. Repeat. Remember.</span></footer>
  </body></html>;
}
