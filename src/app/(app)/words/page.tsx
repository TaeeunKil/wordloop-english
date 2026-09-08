import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { WordEditor } from "@/components/word-editor";
import type { Word } from "@/lib/types";
export default async function WordsPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string; page?: string }> }) {
  const params = await searchParams;
  const q = (params.q ?? "").slice(0,200);
  const archived = params.archived === "true";
  const page = Math.max(1, Math.min(33334, Number.parseInt(params.page ?? "1",10) || 1));
  const { client } = await requireUser();
  const { data, error } = await client.rpc("search_words", { p_query: q, p_archived: archived, p_offset: (page - 1) * 30 });
  if (error) throw new Error("Unable to load words");
  const result = data as { total: number; items: Word[] };
  const pageUrl = (p: number) => "/words?" + new URLSearchParams({ q, archived: String(archived), page: String(p) });
  return <><div className="page-heading"><div><p className="eyebrow">WORDS THAT MATTER TO YOU</p><h1>나의 단어장<span className="accent">.</span></h1></div><span>{result.total}개</span></div>
    <WordEditor />
    <form className="filters" action="/words"><label>단어·뜻 검색<input name="q" defaultValue={q} maxLength={200} placeholder="기억하고 싶은 단어 찾기" type="search" /></label>
      <label>표시<select name="archived" defaultValue={String(archived)}><option value="false">학습 중</option><option value="true">보관함</option></select></label><button>검색</button></form>
    <div className="word-list">{result.items.length ? result.items.map(word => <article className="word-row" key={word.id + word.version}>
      <div className="word-copy"><h2 lang="en">{word.term}</h2><p>{word.meaning}</p>{word.example && <p className="quiet" lang="en">{word.example}</p>}{word.note && <p className="small quiet">{word.note}</p>}</div><WordEditor word={word} />
    </article>) : <div className="empty"><h2>{q ? "검색 결과가 없습니다." : archived ? "보관한 단어가 없습니다." : "첫 단어를 남겨 보세요."}</h2><p className="quiet">단어와 뜻을 추가하면 바로 학습할 수 있습니다.</p></div>}</div>
    <nav className="pagination" aria-label="단어장 페이지">{page > 1 && <Link href={pageUrl(page - 1)}>← 이전</Link>}<span>{page} 페이지</span>{page * 30 < result.total && <Link href={pageUrl(page + 1)}>다음 →</Link>}</nav>
  </>;
}
