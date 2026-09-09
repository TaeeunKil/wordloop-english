-- Full example translations and per-user word mastery.
-- Mastery belongs to review_state, never to the shared vocabulary catalog.

alter table public.vocabulary_catalog
  add column example_meaning text not null default ''
    check (length(example_meaning) <= 3000);

alter table public.words
  add column example_meaning text not null default ''
    check (length(example_meaning) <= 3000);

-- Personal snapshots may be edited without changing the shared catalog card.
grant insert(example_meaning), update(example_meaning) on public.words to authenticated;

drop index public.catalog_search;
create index catalog_search on public.vocabulary_catalog using gin
  (to_tsvector('simple'::regconfig, term || ' ' || meaning || ' ' || example || ' ' || example_meaning));

alter table public.review_state
  add column mastery_score smallint not null default 0
    check (mastery_score between 0 and 100);

alter table public.review_events
  add column mastery_before smallint,
  add column mastery_after smallint,
  add column mastery_delta smallint;

alter table public.review_events
  add constraint review_events_mastery_snapshot check (
    (mastery_before is null and mastery_after is null and mastery_delta is null)
    or (mastery_before between 0 and 100 and mastery_after between 0 and 100
      and mastery_delta between -100 and 100)
  );

comment on column public.vocabulary_catalog.example_meaning is
  'Meaning of the full example sentence, distinct from the word gloss in meaning.';
comment on column public.words.example_meaning is
  'Personal snapshot of the full example meaning; editable without changing shared catalog content.';
comment on column public.review_state.mastery_score is
  'Personal 0-100 memory stability estimate. This is separate from spaced-repetition stage and learner ability.';
comment on column public.review_events.mastery_delta is
  'Change applied to the personal word mastery score for this review.';

create or replace function public.submit_review(
  p_id uuid, p_session_id uuid, p_word_id uuid, p_word_version integer, p_state_version integer,
  p_mode text, p_answer text, p_hint_used boolean, p_rating text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); payload jsonb; prior public.review_events;
  w public.words; s public.review_state; correct_value boolean; success boolean;
  next_stage integer; due timestamptz; at_time timestamptz := clock_timestamp(); result jsonb;
  mastery_delta integer; next_mastery integer;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_id is null or p_session_id is null or p_word_id is null or p_word_version is null or p_state_version is null
    or p_word_version < 1 or p_state_version < 0 or p_mode is null or p_mode not in ('typed','choice','self')
    or p_answer is null or length(p_answer)>2000 or p_hint_used is null
    or (p_mode='self' and (p_rating is null or p_rating not in ('good','again') or p_answer <> ''))
    or (p_mode<>'self' and (p_rating is not null or length(btrim(p_answer))=0))
  then raise exception 'INVALID_REVIEW'; end if;

  payload := jsonb_build_object('session_id',p_session_id,'word_id',p_word_id,'word_version',p_word_version,
    'state_version',p_state_version,'mode',p_mode,'answer',p_answer,'hint_used',p_hint_used,'rating',p_rating);
  -- Serialize every user's review/session mutation, including same-ID races across different words.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
  select * into prior from public.review_events where user_id=uid and id=p_id;
  if found then
    if prior.request is distinct from payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return prior.receipt;
  end if;

  perform 1 from public.study_sessions where id=p_session_id and user_id=uid and completed_at is null;
  if not found then raise exception 'SESSION_CLOSED'; end if;
  select * into w from public.words where user_id=uid and id=p_word_id for update;
  if not found or w.archived then raise exception 'WORD_UNAVAILABLE'; end if;
  if w.version <> p_word_version then raise exception 'STALE_WORD'; end if;
  insert into public.review_state(user_id,word_id) values(uid,w.id) on conflict do nothing;
  select * into s from public.review_state where user_id=uid and word_id=w.id for update;
  if s.version <> p_state_version then raise exception 'STALE_REVIEW'; end if;
  if s.reviews > 0 and s.due_at > at_time then raise exception 'REVIEW_NOT_DUE'; end if;

  correct_value := case when p_mode='self' then null
    else public.normalize_answer(p_answer)=public.normalize_answer(w.term) end;
  success := case when p_mode='self' then p_rating='good' else correct_value end;
  next_stage := case when not success then 0
    when p_mode='typed' and not p_hint_used then least(s.stage+1,7) else s.stage end;
  due := case when success and p_mode='typed' and not p_hint_used
    then at_time + make_interval(days => (array[1,3,7,14,30,60,120])[next_stage])
    else at_time + interval '10 minutes' end;

  -- This is deliberately a simple, inspectable learner signal. A clean typed
  -- answer is strongest evidence; a hint, choice, or self-rating is weaker.
  mastery_delta := case
    when p_mode='self' and p_rating='good' then 3
    when p_mode='self' then -12
    when correct_value and p_mode='typed' and not p_hint_used then 15
    when correct_value and p_mode='typed' then 7
    when correct_value then 5
    when p_mode='typed' then -20
    else -12
  end;
  next_mastery := greatest(0, least(100, s.mastery_score + mastery_delta));
  result := jsonb_build_object('id',p_id,'correct',correct_value,'expected_answer',w.term,
    'stage',next_stage,'due_at',due,'reviewed_at',at_time,
    'mastery_before',s.mastery_score,'mastery_after',next_mastery,'mastery_score',next_mastery,
    'mastery_delta',next_mastery-s.mastery_score);

  insert into public.review_events(
    id,user_id,session_id,word_id,mode,answer,expected_answer,hint_used,rating,correct,reviewed_at,
    request,receipt,mastery_before,mastery_after,mastery_delta
  ) values(
    p_id,uid,p_session_id,w.id,p_mode,p_answer,w.term,p_hint_used,p_rating,correct_value,at_time,
    payload,result,s.mastery_score,next_mastery,next_mastery-s.mastery_score
  );
  update public.review_state set stage=next_stage,version=version+1,reviews=reviews+1,
    lapses=lapses+case when success then 0 else 1 end,due_at=due,last_reviewed_at=at_time,
    mastery_score=next_mastery
   where user_id=uid and word_id=w.id;
  return result;
end $$;

revoke execute on function public.submit_review(uuid,uuid,uuid,integer,integer,text,text,boolean,text)
  from public, anon;
grant execute on function public.submit_review(uuid,uuid,uuid,integer,integer,text,text,boolean,text)
  to authenticated;

-- Replace the adaptive planner so catalog imports carry the sentence meaning,
-- and the queue exposes the personal mastery meter to the client.
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
      select picked.id, picked.term, picked.meaning, picked.example, c.example_meaning
        from public.select_adaptive_catalog(
          uid, settings.learning_track_code, profile.ability_level,
          greatest(settings.daily_goal - personal_count, 0)::integer
        ) picked
        join public.vocabulary_catalog c on c.id = picked.id
    ), inserted_words as (
      insert into public.words(user_id, term, meaning, example, example_meaning, catalog_id, origin)
        select uid, term, meaning, example, example_meaning, id, 'catalog' from candidates
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
        select picked.id, picked.term, picked.meaning, picked.example, c.example_meaning
          from public.select_adaptive_catalog(
            uid, settings.learning_track_code, profile.ability_level,
            greatest(batch_size - (select count(*) from fresh_words), 0)::integer
          ) picked
          join public.vocabulary_catalog c on c.id = picked.id
      ), inserted_catalog as (
        insert into public.words(user_id, term, meaning, example, example_meaning, catalog_id, origin)
          select uid, term, meaning, example, example_meaning, id, 'catalog' from catalog_candidates
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
               coalesce(s.mastery_score, 0) as mastery_score,
               coalesce(s.reviews, 0) as mastery_reviews,
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
