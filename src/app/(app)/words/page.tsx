import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { WordLibrary } from "@/components/word-editor";
import type { Word } from "@/lib/types";

export default async function WordsPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string; page?: string }> }) {
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 200);
  const archived = params.archived === "true";
  const page = Math.max(1, Math.min(33334, Number.parseInt(params.page ?? "1", 10) || 1));
  const { client, user } = await requireUser();
  const [search, settings] = await Promise.all([
    client.rpc("search_words", { p_query: q, p_archived: archived, p_offset: (page - 1) * 30 }),
    client.from("user_settings").select("time_zone").eq("user_id", user.id).maybeSingle(),
  ]);
  if (search.error || settings.error) throw new Error("Unable to load words");
  const result = search.data as { total: number; items: Word[] };
  const ids = result.items.map(word => word.id);
  const states = ids.length ? await client.from("review_state").select("word_id,last_reviewed_at,due_at").eq("user_id", user.id).in("word_id", ids) : { data: [], error: null };
  if (states.error) throw new Error("Unable to load review dates");
  const timeZone = settings.data?.time_zone ?? "Asia/Seoul";
  const pageUrl = (p: number) => "/words?" + new URLSearchParams({ q, archived: String(archived), page: String(p) });
  return <>
    <div className="page-heading"><div><p className="eyebrow">WORDS / PERSONAL COLLECTION</p><h1>나의 단어장</h1></div><p className="quiet">필요한 표현을, 나만의 문장으로.</p></div>
    <WordLibrary words={result.items} states={states.data ?? []} timeZone={timeZone} total={result.total} query={q} archived={archived} />
    <nav className="pagination" aria-label="단어장 페이지">{page > 1 ? <Link className="button" href={pageUrl(page - 1)}>← 이전</Link> : <span />}
      <span>{page} / {Math.max(page, Math.ceil(result.total / 30))} 페이지</span>
      {page * 30 < result.total ? <Link className="button" href={pageUrl(page + 1)}>다음 →</Link> : <span />}
    </nav>
  </>;
}
