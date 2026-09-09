-- Continue today's practice after the persisted daily batch is complete.
-- A second start appends another batch of fresh personal words and catalog cards
-- without reshuffling or duplicating the existing day plan.

create or replace function public.start_daily_session() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  settings public.user_settings;
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
      select c.id, c.term, c.meaning, c.example
        from public.vocabulary_catalog c
        join public.catalog_track_rules r on r.catalog_id = c.id
        join public.learning_tracks t on t.id = r.track_id
       where c.is_active and t.is_active and t.code = settings.learning_track_code
         and not exists (
           select 1 from public.words existing
            where existing.user_id = uid and existing.catalog_id = c.id
         )
       order by pg_catalog.random()
       limit greatest(settings.daily_goal - personal_count, 0)
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

  -- If the current batch is done, append one more batch. This keeps the daily
  -- goal as a comfortable starting point without turning it into a hard cap.
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
        select c.id, c.term, c.meaning, c.example
          from public.vocabulary_catalog c
          join public.catalog_track_rules r on r.catalog_id = c.id
          join public.learning_tracks t on t.id = r.track_id
         where c.is_active and t.is_active and t.code = settings.learning_track_code
           and not exists (
             select 1 from public.words existing
              where existing.user_id = uid and existing.catalog_id = c.id
           )
         order by pg_catalog.random()
         limit greatest(batch_size - (select count(*) from fresh_words), 0)
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
