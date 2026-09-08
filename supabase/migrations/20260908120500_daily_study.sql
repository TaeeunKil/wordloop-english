-- WordLoop daily study plans.
-- A plan is created once per learner-local calendar day. Its item order is the
-- persisted result of the selection, so refreshes never reshuffle today's work.

alter table public.user_settings
  add column learning_track_code text not null default 'det_120_plus'
    references public.learning_tracks(code);

create table public.study_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  time_zone text not null check (time_zone in ('Asia/Seoul','UTC','America/New_York','Europe/London','Asia/Tokyo')),
  track_code text not null references public.learning_tracks(code),
  goal integer not null check (goal between 1 and 200),
  created_at timestamptz not null default now(),
  unique (user_id, day),
  unique (user_id, id)
);

create table public.study_day_items (
  study_day_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null,
  position smallint not null check (position between 1 and 200),
  source text not null check (source in ('due','fresh','catalog_random')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (study_day_id, word_id),
  unique (study_day_id, position),
  foreign key (user_id, study_day_id) references public.study_days(user_id, id) on delete cascade,
  foreign key (user_id, word_id) references public.words(user_id, id) on delete cascade
);

create index study_days_owner on public.study_days(user_id, day desc);
create index study_day_items_owner on public.study_day_items(user_id, study_day_id, position);

alter table public.study_days enable row level security;
alter table public.study_day_items enable row level security;
revoke all on public.study_days, public.study_day_items from anon, authenticated;
grant select on public.study_days, public.study_day_items to authenticated;
create policy study_days_own on public.study_days for select to authenticated
  using ((select auth.uid()) = user_id);
create policy study_day_items_own on public.study_day_items for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.mark_daily_item_complete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.study_day_items i
     set completed_at = coalesce(i.completed_at, new.reviewed_at)
    from public.study_days d
   where i.study_day_id = d.id
     and i.user_id = new.user_id
     and i.word_id = new.word_id
     and d.day = (new.reviewed_at at time zone d.time_zone)::date
     and i.completed_at is null;
  return new;
end $$;

revoke execute on function public.mark_daily_item_complete() from public, anon, authenticated;
create trigger review_events_mark_daily_item
  after insert on public.review_events
  for each row execute function public.mark_daily_item_complete();

create function public.start_daily_session() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  settings public.user_settings;
  day_id uuid;
  session_id uuid;
  personal_count integer;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;

  -- This lock serializes plan creation, catalog import and review mutations for
  -- one learner. It also makes concurrent starts idempotent.
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

    -- Due reviews always lead. Fresh personal words fill the remaining slots.
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

    -- Fill the rest from the learner's active track. The order is intentionally
    -- random, but it is persisted in study_day_items once this transaction ends.
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
