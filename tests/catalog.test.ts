import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const schemaFile = "supabase/migrations/20260908120000_vocabulary_catalog.sql";
const seedFile = "supabase/migrations/20260908120100_vocabulary_catalog_seed.sql";
const expansionFile = "supabase/migrations/20260908120200_vocabulary_catalog_exp1.sql";
const uid = "10000000-0000-4000-8000-000000000001";
const otherUid = "10000000-0000-4000-8000-000000000002";
const legacyWord = "20000000-0000-4000-8000-000000000001";
const catalogId = "md5('wordloop-catalog-v1-L5-1')::uuid";
let db: PGlite;
let legacySnapshot: Record<string, unknown>;
let sharedSnapshots: Record<string, Record<string, unknown>[]>;

async function rows(sql: string) {
  return (await db.query(sql)).rows as Record<string, unknown>[];
}

async function rejected(sql: string, message: RegExp) {
  await db.exec("savepoint expected_failure");
  await expect(db.exec(sql)).rejects.toThrow(message);
  await db.exec("rollback to savepoint expected_failure");
}

async function authenticated(user = uid) {
  await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true);`);
}

describe("shared vocabulary catalog migrations (embedded PostgreSQL)", () => {
  beforeAll(async () => {
    db = new PGlite();
    // Only the Auth boundary is stubbed. Run the real application migrations and RPCs.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
      grant usage on schema auth,public to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;
      insert into auth.users values ('${uid}'),('${otherUid}');
    `);
    await db.exec(readFileSync("supabase/migrations/202609080001_wordloop_v1.sql", "utf8"));
    // Synthetic pre-upgrade record, never imported into the shared content migration.
    await db.exec(`insert into public.words(id,user_id,term,meaning,example,note)
      values('${legacyWord}','${uid}','fixture','검증용 항목','A synthetic test fixture.','synthetic');`);
    [legacySnapshot] = await rows(`select * from public.words where id = '${legacyWord}'`);
    await db.exec(readFileSync(schemaFile, "utf8"));
    await db.exec(readFileSync(seedFile, "utf8"));
    sharedSnapshots = {};
    for (const table of ["difficulty_levels", "learning_tracks", "vocabulary_catalog", "catalog_track_rules"]) {
      sharedSnapshots[table] = await rows(`select * from public.${table} order by 1,2`);
    }
    await db.exec(readFileSync(expansionFile, "utf8"));
  }, 30_000);
  beforeEach(async () => { await db.exec("begin"); });
  afterEach(async () => { await db.exec("rollback"); });
  afterAll(async () => { await db?.close(); });

  it("seeds exactly 350 complete, original shared sense cards, 50 per level", async () => {
    expect(await rows("select count(*)::int n from public.vocabulary_catalog")).toEqual([{ n: 350 }]);
    expect(await rows("select difficulty,count(*)::int n from public.vocabulary_catalog group by difficulty order by difficulty"))
      .toEqual(Array.from({ length: 7 }, (_, i) => ({ difficulty: `L${i + 1}`, n: 50 })));
    expect(await rows(`select id from public.vocabulary_catalog where
      length(btrim(term))=0 or length(btrim(meaning))=0 or length(btrim(example))=0
      or part_of_speech is null or cefr_anchor is null or cefr_band is null
      or cardinality(topics)=0 or cardinality(domains)=0 or cardinality(skills)=0
      or meaning !~ '[가-힣]' or example !~ '[A-Za-z]' or not is_active
      or license <> 'LicenseRef-WordLoop-Original'
      or not (provenance ? 'review_status')
      or not ((content_key like 'wl-v1-%' and source = 'WordLoop original starter catalog' and provenance->>'version' = '1')
        or (content_key like 'wl-exp1-%' and source = 'WordLoop original editorial content' and provenance->>'version' = 'exp1'))
      or frequency_rank is not null or frequency_source is not null`)).toEqual([]);
    expect(await rows(`select normalized_term,normalized_meaning from public.vocabulary_catalog
      group by normalized_term,normalized_meaning having count(*)>1`)).toEqual([]);
    expect(await rows("select count(*)::int n from public.difficulty_levels where guidance_is_heuristic"))
      .toEqual([{ n: 7 }]);
    expect(await rows("select count(*)::int n from public.vocabulary_catalog where normalized_term='book'"))
      .toEqual([{ n: 2 }]);
  });

  it("adds exactly 175 exp1 cards with permanent distinct IDs and matching level metadata", async () => {
    expect(await rows(`select difficulty,count(*)::int n from public.vocabulary_catalog
      where content_key like 'wl-exp1-%' group by difficulty order by difficulty`))
      .toEqual(Array.from({ length: 7 }, (_, i) => ({ difficulty: `L${i + 1}`, n: 25 })));
    expect(await rows(`select c.id from public.vocabulary_catalog c
      join public.difficulty_levels l on l.code=c.difficulty where c.content_key like 'wl-exp1-%' and (
        c.content_key !~ '^wl-exp1-l[1-7]-(00[1-9]|01[0-9]|02[0-5])$'
        or split_part(c.content_key,'-',3) <> lower(c.difficulty)
        or c.id <> ('e1000000-0000-4000-8000-' || lpad(l.ordinal::text,2,'0')
          || lpad(split_part(c.content_key,'-',4)::int::text,10,'0'))::uuid
        or c.cefr_anchor <> l.cefr_anchor or c.cefr_band <> l.cefr_band
        or cardinality(c.topics) <> 1 or cardinality(c.domains) <> 1
        or c.provenance->>'method' <> 'original WordLoop AI-assisted editorial content; no imported course or dictionary text'
      )`)).toEqual([]);
    expect(await rows(`select count(distinct id)::int n from public.vocabulary_catalog`)).toEqual([{ n: 350 }]);
    expect(await rows(`select c.id from public.vocabulary_catalog c
      cross join generate_series(1,7) level cross join generate_series(1,25) seq
      where c.content_key like 'wl-exp1-%' and c.id=md5('wordloop-catalog-v1-L' || level || '-' || seq)::uuid`))
      .toEqual([]);
  });

  it("preserves every existing shared row when applying the expansion", async () => {
    for (const table of ["difficulty_levels", "learning_tracks", "vocabulary_catalog", "catalog_track_rules"]) {
      const filter = table === "vocabulary_catalog" ? "where content_key like 'wl-v1-%'"
        : table === "catalog_track_rules" ? "where catalog_id in (select id from public.vocabulary_catalog where content_key like 'wl-v1-%')"
        : "";
      expect(await rows(`select * from public.${table} ${filter} order by 1,2`)).toEqual(sharedSnapshots[table]);
    }
  });

  it("only seeds shared tables and preserves the pre-upgrade personal snapshot", async () => {
    const [word] = await rows(`select * from public.words where id='${legacyWord}'`);
    expect(word).toEqual({ ...legacySnapshot, catalog_id: null, origin: "custom" });
    expect(await rows("select count(*)::int n from public.words")).toEqual([{ n: 1 }]);
    for (const table of ["user_settings", "study_sessions", "review_state", "review_events"]) {
      expect(await rows(`select count(*)::int n from public.${table}`)).toEqual([{ n: 0 }]);
    }
    const seed = readFileSync(seedFile, "utf8");
    expect([...seed.matchAll(/insert into public\.(\w+)/gi)].map(match => match[1])).toEqual([
      "difficulty_levels", "learning_tracks", "vocabulary_catalog", "catalog_track_rules",
    ]);
    expect(seed).not.toMatch(/\b(user_id|auth\.users|review_events|review_state)\b/);
    const expansion = readFileSync(expansionFile, "utf8");
    expect([...expansion.matchAll(/insert into public\.(\w+)/gi)].map(match => match[1])).toEqual([
      "vocabulary_catalog", "catalog_track_rules",
    ]);
    expect(expansion).not.toMatch(/\b(update|delete|truncate|alter|drop|user_id|auth\.users|public\.words|review_events|review_state)\b/i);
  });

  it("provides all three tracks with valid core/stretch rules and complete coverage", async () => {
    expect(await rows("select code from public.learning_tracks order by code")).toEqual([
      { code: "det_120_plus" }, { code: "toeic_750" }, { code: "toeic_900" },
    ]);
    expect(await rows(`select t.code,count(*)::int n from public.catalog_track_rules r
      join public.learning_tracks t on t.id=r.track_id group by t.code order by t.code`)).toEqual([
      { code: "det_120_plus", n: 350 }, { code: "toeic_750", n: 350 }, { code: "toeic_900", n: 350 },
    ]);
    expect(await rows("select count(*)::int n from public.catalog_track_rules")).toEqual([{ n: 1050 }]);
    expect(await rows(`select c.id from public.vocabulary_catalog c
      left join public.catalog_track_rules r on r.catalog_id=c.id group by c.id having count(r.track_id)<>3`))
      .toEqual([]);
    expect(await rows(`select r.* from public.catalog_track_rules r
      left join public.vocabulary_catalog c on c.id=r.catalog_id
      left join public.learning_tracks t on t.id=r.track_id
      where c.id is null or t.id is null or role not in ('core','stretch','optional')
      or weight <= 0 or weight > 100 or r.priority not between 0 and 100
      or not t.guidance_is_heuristic`)).toEqual([]);
    expect(await rows(`select c.difficulty,r.role,count(*)::int n from public.catalog_track_rules r
      join public.vocabulary_catalog c on c.id=r.catalog_id
      join public.learning_tracks t on t.id=r.track_id
      where t.code='det_120_plus' and r.role<>'optional' group by c.difficulty,r.role order by c.difficulty`))
      .toEqual([{ difficulty: "L5", role: "core", n: 50 }, { difficulty: "L6", role: "stretch", n: 50 }]);
  });

  it("applies the existing editorial roles and domain boosts to all 525 expansion rules", async () => {
    const rules = await rows(`select t.code,c.difficulty,c.domains,r.role,r.priority,r.weight::float8 weight,r.rationale
      from public.catalog_track_rules r join public.vocabulary_catalog c on c.id=r.catalog_id
      join public.learning_tracks t on t.id=r.track_id where c.content_key like 'wl-exp1-%'`);
    expect(rules).toHaveLength(525);
    const levels: Record<string, { core: string[]; stretch: string }> = {
      det_120_plus: { core: ["L5"], stretch: "L6" },
      toeic_750: { core: ["L3", "L4"], stretch: "L5" },
      toeic_900: { core: ["L4", "L5"], stretch: "L6" },
    };
    for (const rule of rules) {
      const level = levels[rule.code as string];
      const role = level.core.includes(rule.difficulty as string) ? "core"
        : rule.difficulty === level.stretch ? "stretch" : "optional";
      const workplace = (rule.domains as string[]).includes("workplace");
      const boost = rule.code === "det_120_plus" ? !workplace : workplace;
      expect(rule.role).toBe(role);
      expect(rule.priority).toBe(({ core: 80, stretch: 50, optional: 10 })[role] + (boost ? 10 : 0));
      expect(rule.weight).toBeCloseTo(({ core: 1, stretch: 0.35, optional: 0.1 })[role] * (boost ? 1.2 : 1));
      expect(rule.rationale).toBe("Editorial level rule; domain affinity adds priority. Optional means fallback, not automatic promotion.");
    }
  });

  it("enforces sense normalization and content constraints at the database boundary", async () => {
    await rejected(`insert into public.vocabulary_catalog(content_key,term,meaning,example,part_of_speech,
      difficulty,cefr_anchor,cefr_band,topics,domains,skills,source,license,provenance)
      select 'duplicate-test',E'  ALLOCATE\\t',meaning,example,part_of_speech,difficulty,cefr_anchor,
      cefr_band,topics,domains,skills,source,license,provenance from public.vocabulary_catalog where id=${catalogId}`,
    /catalog_sense_unique/);
    await rejected(`update public.vocabulary_catalog set difficulty='L8' where id=${catalogId}`, /foreign key/);
    await rejected(`update public.vocabulary_catalog set skills=array['invalid'] where id=${catalogId}`, /check constraint/);
    await rejected(`update public.vocabulary_catalog set frequency_rank=1 where id=${catalogId}`, /catalog_frequency_provenance/);
    await rejected(`update public.catalog_track_rules set role='invalid' where catalog_id=${catalogId}`, /check constraint/);
    await rejected(`update public.catalog_track_rules set weight=0 where catalog_id=${catalogId}`, /check constraint/);
  });

  it("exposes active content to authenticated users but denies catalog mutation and anonymous reads", async () => {
    await db.exec(`update public.vocabulary_catalog set is_active=false where id=${catalogId}`);
    await authenticated();
    expect(await rows("select count(*)::int n from public.vocabulary_catalog")).toEqual([{ n: 349 }]);
    expect(await rows("select count(*)::int n from public.catalog_track_rules")).toEqual([{ n: 1047 }]);
    await rejected("update public.vocabulary_catalog set priority=1", /permission denied/);
    await rejected("delete from public.learning_tracks", /permission denied/);
    await rejected("update public.catalog_track_rules set weight=2", /permission denied/);
    await rejected("update public.difficulty_levels set label='changed'", /permission denied/);
    await db.exec("set local role anon");
    await rejected("select * from public.vocabulary_catalog", /permission denied/);
  });

  it("keeps per-user catalog snapshots unique even after archiving, without sharing ownership", async () => {
    await authenticated();
    const insert = `insert into public.words(user_id,term,meaning,example,catalog_id,origin)
      select '${uid}',term,meaning,example,id,'catalog' from public.vocabulary_catalog where id=${catalogId}`;
    await db.exec(insert);
    await db.exec(`update public.words set meaning='개인 메모용 뜻',archived=true where catalog_id=${catalogId}`);
    await rejected(insert, /words_owner_catalog_unique/);
    await rejected(`insert into public.words(term,meaning,origin) values('x','x','catalog')`, /words_catalog_origin/);
    await rejected(`update public.words set catalog_id=null where catalog_id=${catalogId}`, /permission denied/);
    await authenticated(otherUid);
    expect(await rows("select * from public.words")).toEqual([]);
    await rejected(insert, /row-level security/);
    await db.exec(insert.replace(uid, otherUid));
    await db.exec("reset role");
    await db.exec(`update public.vocabulary_catalog set meaning='공용 뜻 수정',example='An updated shared example.' where id=${catalogId}`);
    expect(await rows(`select meaning from public.words where user_id='${uid}' and catalog_id=${catalogId}`))
      .toEqual([{ meaning: "개인 메모용 뜻" }]);
    await rejected(`delete from public.vocabulary_catalog where id=${catalogId}`, /foreign key/);
  });

  it("preserves real review idempotency, stale versions, queues and user isolation", async () => {
    await authenticated();
    // Use an actual imported catalog card to cover the new words columns in the old RPC.
    await db.exec(`insert into public.words(id,term,meaning,example,catalog_id,origin)
      select '20000000-0000-4000-8000-000000000002',term,meaning,example,id,'catalog'
      from public.vocabulary_catalog where id=${catalogId}`);
    const wordId = "20000000-0000-4000-8000-000000000002";
    const [{ sid }] = await rows("select public.start_session() sid");
    const review = (id: string, wordVersion = 1, stateVersion = 0, answer = "allocate") =>
      `select public.submit_review('${id}','${sid}','${wordId}',${wordVersion},${stateVersion},'typed','${answer}',false,null) receipt`;
    const event1 = "30000000-0000-4000-8000-000000000001";
    const event2 = "30000000-0000-4000-8000-000000000002";
    const receipt = await rows(review(event1));
    expect(receipt[0].receipt).toMatchObject({ correct: true, expected_answer: "allocate", stage: 1 });
    expect(await rows(review(event1))).toEqual(receipt);
    await rejected(review(event1, 1, 0, "other"), /IDEMPOTENCY_CONFLICT/);
    await rejected(review(event2, 1, 0), /STALE_REVIEW/);
    await rejected(review(event2, 1, 1), /REVIEW_NOT_DUE/);
    await db.exec(`update public.words set note='Synthetic edit' where id='${wordId}'`);
    await rejected(review(event2, 1, 1), /STALE_WORD/);
    expect(await rows("select reviews,version from public.review_state")).toEqual([{ reviews: 1, version: 1 }]);
    expect(await rows("select count(*)::int n from public.review_events")).toEqual([{ n: 1 }]);
    const [{ queue }] = await rows("select public.study_queue() queue");
    expect(queue).toEqual([expect.objectContaining({ id: legacyWord, origin: "custom", catalog_id: null })]);
    await authenticated(otherUid);
    expect(await rows("select * from public.review_events")).toEqual([]);
    expect(await rows("select * from public.review_state")).toEqual([]);
    expect(await rows("select public.study_queue() queue")).toEqual([{ queue: [] }]);
  });
});
