import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const uid = "10000000-0000-4000-8000-000000000001";
const dueWord = "20000000-0000-4000-8000-000000000001";
const freshWord = "20000000-0000-4000-8000-000000000002";
let db: PGlite;

async function rows(sql: string) {
  return (await db.query(sql)).rows as Record<string, unknown>[];
}

type DailyItem = { id: string; term: string; version: number; state_version: number; daily_source?: string };
type DailyPlan = { session_id: string; day: string; queue: DailyItem[] };

describe("daily study plans", () => {
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
      insert into auth.users values ('${uid}');
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
    ]) {
      await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
    }
  }, 30_000);
  beforeEach(async () => {
    await db.exec("begin");
  });
  afterEach(async () => { await db.exec("rollback"); });
  afterAll(async () => { await db?.close(); });

  it("creates one due-first plan, fills it with random catalog cards, and reuses its order", async () => {
    await db.exec(`
      insert into public.user_settings(user_id,daily_goal) values ('${uid}',5);
      insert into public.words(id,user_id,term,meaning,example,note)
        values ('${dueWord}','${uid}','remember','기억하다','I remember the answer.',''),
               ('${freshWord}','${uid}','practice','연습하다','I practice every day.','');
      insert into public.review_state(user_id,word_id,stage,version,reviews,due_at)
        values ('${uid}','${dueWord}',2,0,1,now() - interval '1 minute');
    `);
    await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true);`);

    const [{ plan: rawFirst }] = await rows("select public.start_daily_session() plan");
    const first = rawFirst as DailyPlan;
    expect(first.queue).toHaveLength(5);
    expect(first.queue[0]).toMatchObject({ id: dueWord, daily_source: "due" });
    expect(first.queue[1]).toMatchObject({ id: freshWord, daily_source: "fresh" });
    expect(first.queue.slice(2).every((item: Record<string, unknown>) => item.daily_source === "catalog_random")).toBe(true);

    const firstIds = first.queue.map(item => item.id);
    expect(await rows(`select count(*)::int n from public.words where user_id='${uid}'`)).toEqual([{ n: 5 }]);
    expect(await rows(`select count(*)::int n from public.study_day_items where user_id='${uid}'`)).toEqual([{ n: 5 }]);

    const [{ plan: rawSecond }] = await rows("select public.start_daily_session() plan");
    const second = rawSecond as DailyPlan;
    expect(second.day).toBe(first.day);
    expect(second.queue.map(item => item.id)).toEqual(firstIds);
  });

  it("removes a completed item from the persisted day's remaining queue", async () => {
    await db.exec(`insert into public.user_settings(user_id,daily_goal) values ('${uid}',2);`);
    await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true);`);
    const [{ plan: rawPlan }] = await rows("select public.start_daily_session() plan");
    const plan = rawPlan as DailyPlan;
    const item = plan.queue[0];
    await db.exec(`select public.submit_review(
      '30000000-0000-4000-8000-000000000001',
      '${plan.session_id}', '${item.id}', ${item.version}, ${item.state_version},
      'typed', '${item.term}', false, null
    )`);
    const [{ remaining: rawRemaining }] = await rows("select public.start_daily_session() remaining");
    const remaining = rawRemaining as DailyPlan;
    expect(remaining.queue).toHaveLength(1);
    expect(remaining.queue[0].id).not.toBe(item.id);
    expect(await rows(`select completed_at is not null completed from public.study_day_items where word_id='${item.id}'`)).toEqual([{ completed: true }]);
  });

  it("appends another batch after the daily batch is complete", async () => {
    await db.exec(`insert into public.user_settings(user_id,daily_goal) values ('${uid}',2);`);
    await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true);`);
    const [{ plan: rawFirst }] = await rows("select public.start_daily_session() plan");
    const first = rawFirst as DailyPlan;
    expect(first.queue).toHaveLength(2);

    for (const [index, item] of first.queue.entries()) {
      await db.exec(`select public.submit_review(
        '30000000-0000-4000-8000-00000000010${index}',
        '${first.session_id}', '${item.id}', ${item.version}, ${item.state_version},
        'typed', '${item.term}', false, null
      )`);
    }

    const [{ plan: rawBonus }] = await rows("select public.start_daily_session() plan");
    const bonus = rawBonus as DailyPlan;
    expect(bonus.queue).toHaveLength(2);
    expect(bonus.queue.map(item => item.id)).not.toEqual(first.queue.map(item => item.id));
    expect(bonus.queue.every(item => item.daily_source === "catalog_random" || item.daily_source === "fresh")).toBe(true);
    expect(await rows(`select count(*)::int n from public.study_day_items where user_id='${uid}'`)).toEqual([{ n: 4 }]);
  });
});
