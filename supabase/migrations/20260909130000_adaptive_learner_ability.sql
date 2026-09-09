-- Adaptive learner ability is personal state, separate from shared card difficulty
-- and per-word spaced-repetition state.

create table public.user_ability (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score numeric(7,2) not null default 500.00 check (score between 0 and 1000),
  ability_level smallint not null default 4 check (ability_level between 1 and 7),
  confidence numeric(4,3) not null default 0.000 check (confidence between 0 and 1),
  sample_count integer not null default 0 check (sample_count >= 0),
  updated_at timestamptz not null default now()
);

create index user_ability_updated on public.user_ability(updated_at desc);

alter table public.user_ability enable row level security;
revoke all on public.user_ability from public, anon, authenticated;
grant select on public.user_ability to authenticated;
create policy user_ability_own on public.user_ability for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.ability_level_for_score(p_score numeric)
returns smallint language sql immutable strict set search_path = '' as $$
  select case
    when p_score < 143 then 1
    when p_score < 286 then 2
    when p_score < 429 then 3
    when p_score < 571 then 4
    when p_score < 714 then 5
    when p_score < 857 then 6
    else 7
  end::smallint;
$$;

revoke execute on function public.ability_level_for_score(numeric) from public, anon, authenticated;

alter table public.review_events
  add column ability_before numeric(7,2),
  add column ability_after numeric(7,2),
  add column ability_delta numeric(7,2),
  add column ability_level smallint;

alter table public.review_events
  add constraint review_events_ability_snapshot check (
    (ability_before is null and ability_after is null and ability_delta is null and ability_level is null)
    or (ability_before between 0 and 1000 and ability_after between 0 and 1000
      and ability_delta between -1000 and 1000 and ability_level between 1 and 7)
  );

create function public.apply_ability_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  profile public.user_ability;
  item_level smallint := 4;
  expected numeric;
  outcome numeric;
  evidence_weight numeric;
  delta numeric := 0;
  next_score numeric;
  next_level smallint;
  next_samples integer;
  next_confidence numeric;
begin
  insert into public.user_ability(user_id) values (new.user_id) on conflict do nothing;
  select * into profile from public.user_ability where user_id = new.user_id for update;

  select coalesce(dl.ordinal, 4)::smallint into item_level
    from public.words w
    left join public.vocabulary_catalog c on c.id = w.catalog_id
    left join public.difficulty_levels dl on dl.code = c.difficulty
   where w.user_id = new.user_id and w.id = new.word_id;

  if new.mode <> 'self' then
    expected := 1 / (1 + pg_catalog.exp((item_level - profile.ability_level)::numeric * 0.7));
    outcome := case when new.correct then 1 else 0 end;
    evidence_weight := case
      when new.mode = 'typed' and not new.hint_used then 1.00
      when new.mode = 'typed' and new.hint_used then 0.35
      when new.mode = 'choice' then 0.45
      else 0.10
    end;
    delta := round(80 * evidence_weight * (outcome - expected), 2);
    next_samples := profile.sample_count + 1;
    next_confidence := least(1.000::numeric, next_samples / 20.000::numeric);
  else
    next_samples := profile.sample_count;
    next_confidence := profile.confidence;
  end if;

  next_score := round(least(1000.00::numeric, greatest(0.00::numeric, profile.score + delta)), 2);
  next_level := public.ability_level_for_score(next_score);

  update public.user_ability
     set score = next_score,
         ability_level = next_level,
         confidence = next_confidence,
         sample_count = next_samples,
         updated_at = pg_catalog.clock_timestamp()
   where user_id = new.user_id;

  new.ability_before := profile.score;
  new.ability_after := next_score;
  new.ability_delta := round(next_score - profile.score, 2);
  new.ability_level := next_level;
  return new;
end $$;

revoke execute on function public.apply_ability_update() from public, anon, authenticated;
create trigger review_events_update_ability
  before insert on public.review_events
  for each row execute function public.apply_ability_update();

-- Return a weighted adaptive sample: 60% at the current level, 25% one level
-- below, and the remainder one level above. A fill pass handles empty bands.
create function public.select_adaptive_catalog(
  p_user_id uuid, p_track_code text, p_ability_level smallint, p_limit integer
) returns table(id uuid, term text, meaning text, example text)
language sql stable security definer set search_path = '' as $$
with candidate_pool as (
  select distinct c.id, c.term, c.meaning, c.example, dl.ordinal as level, r.priority
    from public.vocabulary_catalog c
    join public.difficulty_levels dl on dl.code = c.difficulty
    join public.catalog_track_rules r on r.catalog_id = c.id
    join public.learning_tracks t on t.id = r.track_id
   where c.is_active and t.is_active and t.code = p_track_code
     and not exists (
       select 1 from public.words existing
        where existing.user_id = p_user_id and existing.catalog_id = c.id
     )
), at_level as (
  select c.*, row_number() over (order by c.priority desc, pg_catalog.random()) as rn
    from candidate_pool c
   where c.level = least(greatest(p_ability_level, 1), 7)
), below_level as (
  select c.*, row_number() over (order by c.priority desc, pg_catalog.random()) as rn
    from candidate_pool c
   where c.level = greatest(p_ability_level - 1, 1)
), above_level as (
  select c.*, row_number() over (order by c.priority desc, pg_catalog.random()) as rn
    from candidate_pool c
   where c.level = least(p_ability_level + 1, 7)
), preferred as (
  select id, term, meaning, example from at_level
   where rn <= pg_catalog.ceil(p_limit * 0.60)::integer
  union all
  select id, term, meaning, example from below_level
   where rn <= pg_catalog.ceil(p_limit * 0.25)::integer
  union all
  select id, term, meaning, example from above_level
   where rn <= greatest(p_limit - pg_catalog.ceil(p_limit * 0.60)::integer
                         - pg_catalog.ceil(p_limit * 0.25)::integer, 0)
), preferred_distinct as (
  select distinct on (id) id, term, meaning, example
    from preferred
   order by id
), fill as (
  select c.id, c.term, c.meaning, c.example
    from candidate_pool c
   where not exists (select 1 from preferred_distinct p where p.id = c.id)
   order by c.priority desc, pg_catalog.random()
   limit greatest(p_limit - (select count(*) from preferred_distinct), 0)
)
select id, term, meaning, example from (
  select * from preferred_distinct
  union all
  select * from fill
) selected
order by pg_catalog.random()
limit greatest(p_limit, 0);
$$;

revoke execute on function public.select_adaptive_catalog(uuid,text,smallint,integer) from public, anon, authenticated;

-- Replace the daily planner so first and bonus batches use the personal ability
-- profile while preserving the existing persisted-day and due-first contract.
create or replace function public.start_daily_session() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  settings public.user_settings;
  profile public.user_ability;
  day_id uuid;
  session_id uuid;
  personal_count integer;
  remaining_count integer;
  base_position integer;
  batch_size integer;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));

  insert into public.user_settings(user_id) values (uid) on conflict do nothing;
  select * into settings from public.user_settings where user_id = uid;
  insert into public.user_ability(user_id) values (uid) on conflict do nothing;
  select * into profile from public.user_ability where user_id = uid;

  select id into session_id
    from public.study_sessions
   where user_id = uid and completed_at is null;
  if session_id is null then
    insert into public.study_sessions(user_id) values (uid) returning id into session_id;
  end if;

  select id into day_id
    from public.study_days
   where user_id = uid
     and day = (pg_catalog.clock_timestamp() at time zone settings.time_zone)::date;

  if day_id is null then
    insert into public.study_days(user_id, day, time_zone, track_code, goal)
      values (uid, (pg_catalog.clock_timestamp() at time zone settings.time_zone)::date,
              settings.time_zone, settings.learning_track_code, settings.daily_goal)
      returning id into day_id;

    with due_words as (
      select w.id, row_number() over (order by s.due_at asc, w.created_at, w.id) as position
        from public.words w
        join public.review_state s on s.user_id = uid and s.word_id = w.id
       where w.user_id = uid and not w.archived and s.due_at <= pg_catalog.clock_timestamp()
       limit settings.daily_goal
    ), fresh_words as (
      select w.id,
             (select count(*) from due_words) +
             row_number() over (order by w.created_at, w.id) as position
        from public.words w
       where w.user_id = uid and not w.archived
         and not exists (select 1 from public.review_state s where s.user_id = uid and s.word_id = w.id)
       limit greatest(settings.daily_goal - (select count(*) from due_words), 0)
    )
    insert into public.study_day_items(user_id, study_day_id, word_id, position, source)
      select uid, day_id, id, position::smallint, 'due' from due_words
      union all
      select uid, day_id, id, position::smallint, 'fresh' from fresh_words;

    select count(*) into personal_count from public.study_day_items where study_day_id = day_id;

    with candidates as (
      select * from public.select_adaptive_catalog(
        uid, settings.learning_track_code, profile.ability_level,
        greatest(settings.daily_goal - personal_count, 0)::integer
      )
    ), inserted_words as (
      insert into public.words(user_id, term, meaning, example, catalog_id, origin)
        select uid, term, meaning, example, id, 'catalog' from candidates
        on conflict (user_id, catalog_id) where (catalog_id is not null) do nothing
        returning id
    )
    insert into public.study_day_items(user_id, study_day_id, word_id, position, source)
      select uid, day_id, id,
             (personal_count + row_number() over (order by pg_catalog.random()))::smallint,
             'catalog_random'
        from inserted_words;
  end if;

  select count(*) into remaining_count
    from public.study_day_items i
    join public.words w on w.user_id = i.user_id and w.id = i.word_id
   where i.study_day_id = day_id and i.completed_at is null and not w.archived;

  if remaining_count = 0 then
    select coalesce(max(position), 0) into base_position
      from public.study_day_items where study_day_id = day_id;
    batch_size := least(settings.daily_goal, greatest(200 - base_position, 0));

    if batch_size > 0 then
      with fresh_words as (
        select w.id, row_number() over (order by w.created_at, w.id) as position
          from public.words w
         where w.user_id = uid and not w.archived
           and not exists (select 1 from public.review_state s where s.user_id = uid and s.word_id = w.id)
           and not exists (select 1 from public.study_day_items i where i.study_day_id = day_id and i.word_id = w.id)
         limit batch_size
      ), catalog_candidates as (
        select * from public.select_adaptive_catalog(
          uid, settings.learning_track_code, profile.ability_level,
          greatest(batch_size - (select count(*) from fresh_words), 0)::integer
        )
      ), inserted_catalog as (
        insert into public.words(user_id, term, meaning, example, catalog_id, origin)
          select uid, term, meaning, example, id, 'catalog' from catalog_candidates
          on conflict (user_id, catalog_id) where (catalog_id is not null) do nothing
          returning id
      ), batch as (
        select id, position, 'fresh'::text as source from fresh_words
        union all
        select id,
               (select count(*) from fresh_words) + row_number() over (order by pg_catalog.random()),
               'catalog_random'::text
          from inserted_catalog
      )
      insert into public.study_day_items(user_id, study_day_id, word_id, position, source)
        select uid, day_id, id, (base_position + position)::smallint, source from batch;
    end if;
  end if;

  return (
    select jsonb_build_object(
      'session_id', session_id,
      'day', d.day,
      'goal', d.goal,
      'track_code', d.track_code,
      'ability', jsonb_build_object(
        'score', profile.score,
        'level', profile.ability_level,
        'confidence', profile.confidence,
        'sample_count', profile.sample_count
      ),
      'queue', coalesce(jsonb_agg(to_jsonb(q) order by q.position) filter (where q.id is not null), '[]'::jsonb)
    )
      from public.study_days d
      left join (
        select i.position, i.source as daily_source, w.*,
               coalesce(s.stage, 0) as stage,
               coalesce(s.version, 0) as state_version,
               s.due_at
          from public.study_day_items i
          join public.words w on w.user_id = i.user_id and w.id = i.word_id
          left join public.review_state s on s.user_id = w.user_id and s.word_id = w.id
         where i.study_day_id = day_id and i.completed_at is null and not w.archived
      ) q on true
     where d.id = day_id
     group by d.id, d.day, d.goal, d.track_code
  );
end $$;

revoke execute on function public.start_daily_session() from public, anon, authenticated;
grant execute on function public.start_daily_session() to authenticated;
