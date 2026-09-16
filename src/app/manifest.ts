import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WordLoop — 나의 영어 단어장",
    short_name: "WordLoop",
    id: "/dashboard",
    description: "매일 한 단어씩 직접 떠올리고, 나만의 학습 기록으로 남기는 영어 연습 공간.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#f4f1ea",
    orientation: "portrait-primary",
    lang: "ko",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
