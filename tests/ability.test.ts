import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const uid = "10000000-0000-4000-8000-000000000001";
const otherUid = "10000000-0000-4000-8000-000000000002";
let db: PGlite;

async function rows(sql: string) {
  return (await db.query(sql)).rows as Record<string, unknown>[];
}

async function start(user = uid) {
  await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true);`);
  const [{ plan }] = await rows("select public.start_daily_session() plan");
  return plan as {
    session_id: string;
    queue: {
      id: string; term: string; version: number; state_version: number;
      example_meaning: string; mastery_score: number; mastery_reviews: number;
    }[];
  };
}

describe("adaptive learner ability", () => {
  beforeAll(async () => {
    db = new PGlite();
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
    for (const migration of [
      "202609080001_wordloop_v1.sql",
      "20260908120000_vocabulary_catalog.sql",
      "20260908120100_vocabulary_catalog_seed.sql",
      "20260908120200_vocabulary_catalog_exp1.sql",
      "20260908120300_vocabulary_catalog_exp2.sql",
      "20260908120400_vocabulary_catalog_exp3.sql",
      "20260908120500_daily_study.sql",
      "20260908120600_daily_continue.sql",
      "20260909130000_adaptive_learner_ability.sql",
      "20260909150000_word_mastery_and_example_meaning.sql",
      "20260909150100_vocabulary_example_meanings.sql",
    ]) await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
  }, 30_000);
  beforeEach(async () => { await db.exec("begin"); });
  afterEach(async () => { await db.exec("rollback"); });
  afterAll(async () => { await db?.close(); });

  it("starts at L4 and samples around the personal ability level", async () => {
    await db.exec(`insert into public.user_settings(user_id,daily_goal) values ('${uid}',6);`);
    await start();
    const [initial] = await rows(`select score,ability_level,confidence,sample_count from public.user_ability where user_id='${uid}'`);
    expect({ score: Number(initial.score), ability_level: initial.ability_level, confidence: Number(initial.confidence), sample_count: initial.sample_count })
      .toEqual({ score: 500, ability_level: 4, confidence: 0, sample_count: 0 });

    const levels = await rows(`select c.difficulty,count(*)::int n
      from public.study_day_items i
      join public.words w on w.user_id=i.user_id and w.id=i.word_id
      join public.vocabulary_catalog c on c.id=w.catalog_id
      where i.user_id='${uid}' group by c.difficulty order by c.difficulty`);
    expect(levels).toEqual([{ difficulty: "L3", n: 2 }, { difficulty: "L4", n: 4 }]);

    await db.exec(`reset role; update public.user_ability set score=800,ability_level=6 where user_id='${uid}';`);
    await db.exec(`delete from public.study_days where user_id='${uid}';`);
    await db.exec(`delete from public.study_sessions where user_id='${uid}';`);
    await db.exec(`delete from public.words where user_id='${uid}';`);
    const advanced = await start();
    expect(advanced.queue).toHaveLength(6);
    const advancedLevels = await rows(`select c.difficulty,count(*)::int n
      from public.study_day_items i
      join public.words w on w.user_id=i.user_id and w.id=i.word_id
      join public.vocabulary_catalog c on c.id=w.catalog_id
      where i.user_id='${uid}' group by c.difficulty order by c.difficulty`);
    expect(advancedLevels).toEqual([{ difficulty: "L5", n: 2 }, { difficulty: "L6", n: 4 }]);
  });

  it("weights direct evidence, ignores self-ratings, and is idempotent", async () => {
    await db.exec(`insert into public.user_settings(user_id,daily_goal) values ('${uid}',2);`);
    const plan = await start();
    const item = plan.queue[0];
    const reviewId = "30000000-0000-4000-8000-000000000001";
    const review = `select public.submit_review('${reviewId}','${plan.session_id}','${item.id}',${item.version},${item.state_version},'typed',(select term from public.words where id='${item.id}'),false,null)`;
    await db.exec(review);
    const [afterTyped] = await rows(`select score,ability_level,confidence,sample_count from public.user_ability where user_id='${uid}'`);
    expect(Number(afterTyped.score)).toBeGreaterThan(500);
    expect(afterTyped.sample_count).toBe(1);
    expect(Number(afterTyped.confidence)).toBeCloseTo(0.05);
    const [event] = await rows(`select ability_before,ability_after,ability_delta,ability_level from public.review_events where id='${reviewId}'`);
    expect({ ability_before: Number(event.ability_before), ability_after: Number(event.ability_after), ability_delta: Number(event.ability_delta), ability_level: event.ability_level })
      .toEqual({ ability_before: 500, ability_after: Number(afterTyped.score), ability_delta: Math.round((Number(afterTyped.score) - 500) * 100) / 100, ability_level: afterTyped.ability_level });

    await db.exec(review);
    expect(await rows(`select count(*)::int n from public.review_events where user_id='${uid}'`)).toEqual([{ n: 1 }]);
    const [afterRetry] = await rows(`select score,sample_count from public.user_ability where user_id='${uid}'`);
    expect({ score: Number(afterRetry.score), sample_count: afterRetry.sample_count }).toEqual({ score: Number(afterTyped.score), sample_count: 1 });

    const second = plan.queue[1];
    await db.exec(`select public.submit_review('30000000-0000-4000-8000-000000000002','${plan.session_id}','${second.id}',${second.version},${second.state_version},'self','',false,'good')`);
    const [afterSelf] = await rows(`select score,sample_count from public.user_ability where user_id='${uid}'`);
    expect({ score: Number(afterSelf.score), sample_count: afterSelf.sample_count }).toEqual({ score: Number(afterTyped.score), sample_count: 1 });
  });

  it("keeps ability profiles private to their owner", async () => {
    await db.exec(`reset role; insert into public.user_ability(user_id) values ('${uid}');`);
    await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${otherUid}',true);`);
    expect(await rows("select * from public.user_ability")).toEqual([]);
  });

  it("copies sentence meanings and records personal word mastery", async () => {
    await db.exec(`insert into public.user_settings(user_id,daily_goal) values ('${uid}',2);`);
    const plan = await start();
    expect(plan.queue[0]).toMatchObject({ example_meaning: expect.any(String), mastery_score: 0, mastery_reviews: 0 });
    expect(plan.queue[0].example_meaning.length).toBeGreaterThan(0);
    expect(await rows("select count(*)::int n from public.vocabulary_catalog where length(btrim(example_meaning)) = 0"))
      .toEqual([{ n: 0 }]);

    const correct = plan.queue[0];
    const wrong = plan.queue[1];
    await db.exec(`select public.submit_review(
      '30000000-0000-4000-8000-000000000011','${plan.session_id}','${correct.id}',${correct.version},${correct.state_version},
      'typed','${correct.term}',false,null
    )`);
    await db.exec(`select public.submit_review(
      '30000000-0000-4000-8000-000000000012','${plan.session_id}','${wrong.id}',${wrong.version},${wrong.state_version},
      'typed','not-the-answer',false,null
    )`);

    expect(await rows(`select word_id,mastery_score,reviews from public.review_state where user_id='${uid}' order by word_id`))
      .toEqual([
        { word_id: correct.id, mastery_score: 15, reviews: 1 },
        { word_id: wrong.id, mastery_score: 0, reviews: 1 },
      ].sort((a, b) => a.word_id.localeCompare(b.word_id)));
    expect(await rows(`select mastery_before,mastery_after,mastery_delta from public.review_events where user_id='${uid}' order by id`))
      .toEqual([
        { mastery_before: 0, mastery_after: 15, mastery_delta: 15 },
        { mastery_before: 0, mastery_after: 0, mastery_delta: 0 },
      ]);
  });
});
