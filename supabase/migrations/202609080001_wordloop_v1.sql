-- WordLoop v1. No seeds or real user records.
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  time_zone text not null default 'Asia/Seoul' check (time_zone in ('Asia/Seoul','UTC','America/New_York','Europe/London','Asia/Tokyo')),
  daily_goal integer not null default 20 check (daily_goal between 1 and 200)
);
create table public.words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  term text not null check (length(btrim(term)) between 1 and 200),
  meaning text not null check (length(btrim(meaning)) between 1 and 2000),
  example text not null default '' check (length(example) <= 3000),
  note text not null default '' check (length(note) <= 3000),
  archived boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,id)
);
create index words_owner on public.words(user_id,archived,created_at);
create function public.touch_word() returns trigger language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := clock_timestamp();
  return new;
end $$;
create trigger words_touch before update on public.words for each row execute function public.touch_word();

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (completed_at is null or completed_at >= started_at),
  unique(user_id,id)
);
create unique index one_open_session on public.study_sessions(user_id) where completed_at is null;

create table public.review_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null,
  stage integer not null default 0 check(stage between 0 and 7),
  version integer not null default 0 check(version >= 0),
  reviews integer not null default 0 check(reviews >= 0),
  lapses integer not null default 0 check(lapses between 0 and reviews),
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  primary key(user_id,word_id),
  foreign key(user_id,word_id) references public.words(user_id,id) on delete cascade
);
create index review_due on public.review_state(user_id,due_at);

create table public.review_events (
  id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  word_id uuid not null,
  mode text not null check(mode in ('typed','choice','self')),
  answer text not null check(length(answer) <= 2000),
  expected_answer text not null,
  hint_used boolean not null,
  rating text check(rating in ('good','again')),
  correct boolean,
  reviewed_at timestamptz not null,
  request jsonb not null,
  receipt jsonb not null,
  primary key(user_id,id),
  foreign key(user_id,session_id) references public.study_sessions(user_id,id),
  foreign key(user_id,word_id) references public.words(user_id,id),
  check ((mode = 'self' and rating is not null and correct is null and answer = '')
      or (mode <> 'self' and rating is null and correct is not null and length(btrim(answer)) > 0))
);
create index review_history on public.review_events(user_id,reviewed_at desc);
create index review_session on public.review_events(user_id,session_id);

alter table public.user_settings enable row level security;
alter table public.words enable row level security;
alter table public.study_sessions enable row level security;
alter table public.review_events enable row level security;
alter table public.review_state enable row level security;

create policy settings_own on public.user_settings for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy words_read on public.words for select to authenticated using ((select auth.uid()) = user_id);
create policy words_insert on public.words for insert to authenticated with check ((select auth.uid()) = user_id);
create policy words_update on public.words for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy sessions_read on public.study_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy events_read on public.review_events for select to authenticated using ((select auth.uid()) = user_id);
create policy state_read on public.review_state for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.user_settings, public.words, public.study_sessions, public.review_events, public.review_state from anon, authenticated;
grant select on public.user_settings, public.words, public.study_sessions, public.review_events, public.review_state to authenticated;
grant insert(user_id,time_zone,daily_goal), update(time_zone,daily_goal) on public.user_settings to authenticated;
grant insert(id,user_id,term,meaning,example,note), update(term,meaning,example,note,archived) on public.words to authenticated;

create function public.start_session() returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); sid uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
  insert into public.user_settings(user_id) values(uid) on conflict do nothing;
  select id into sid from public.study_sessions where user_id=uid and completed_at is null;
  if sid is null then
    insert into public.study_sessions(user_id) values(uid) returning id into sid;
  end if;
  return sid;
end $$;

create function public.finish_session(p_session_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,0));
  update public.study_sessions set completed_at=coalesce(completed_at,clock_timestamp()) where id=p_session_id and user_id=uid;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
end $$;

-- ASCII whitespace/case normalization only, shared product contract; punctuation stays meaningful.
create function public.normalize_answer(value text) returns text language sql immutable strict set search_path = '' as $$
  select pg_catalog.translate(pg_catalog.btrim(pg_catalog.regexp_replace(value, E'[\\t\\n\\r ]+', ' ', 'g')), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz');
$$;

create function public.submit_review(
  p_id uuid, p_session_id uuid, p_word_id uuid, p_word_version integer, p_state_version integer,
  p_mode text, p_answer text, p_hint_used boolean, p_rating text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); payload jsonb; prior public.review_events;
  w public.words; s public.review_state; correct_value boolean; success boolean;
  next_stage integer; due timestamptz; at_time timestamptz := clock_timestamp(); result jsonb;
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
  correct_value := case when p_mode='self' then null else public.normalize_answer(p_answer)=public.normalize_answer(w.term) end;
  success := case when p_mode='self' then p_rating='good' else correct_value end;
  next_stage := case when not success then 0
    when p_mode='typed' and not p_hint_used then least(s.stage+1,7) else s.stage end;
  due := case when success and p_mode='typed' and not p_hint_used
    then at_time + make_interval(days => (array[1,3,7,14,30,60,120])[next_stage])
    else at_time + interval '10 minutes' end;
  result := jsonb_build_object('id',p_id,'correct',correct_value,'expected_answer',w.term,
    'stage',next_stage,'due_at',due,'reviewed_at',at_time);
  insert into public.review_events(id,user_id,session_id,word_id,mode,answer,expected_answer,hint_used,rating,correct,reviewed_at,request,receipt)
    values(p_id,uid,p_session_id,w.id,p_mode,p_answer,w.term,p_hint_used,p_rating,correct_value,at_time,payload,result);
  update public.review_state set stage=next_stage,version=version+1,reviews=reviews+1,
    lapses=lapses+case when success then 0 else 1 end,due_at=due,last_reviewed_at=at_time where user_id=uid and word_id=w.id;
  return result;
end $$;

create function public.study_queue() returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (
    select w.*, coalesce(s.stage,0) stage, coalesce(s.version,0) state_version, s.due_at
    from public.words w left join public.review_state s on s.user_id=w.user_id and s.word_id=w.id
    where w.user_id=auth.uid() and not w.archived and (s.word_id is null or s.due_at<=now())
    order by s.due_at asc nulls last,w.created_at,w.id limit 20
  ) q;
$$;
create function public.search_words(p_query text default '', p_archived boolean default false, p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('total',(select count(*) from public.words w where w.user_id=auth.uid() and w.archived=p_archived
    and (strpos(lower(w.term),lower(left(p_query,200)))>0 or strpos(lower(w.meaning),lower(left(p_query,200)))>0)),
    'items',coalesce((select jsonb_agg(to_jsonb(q)) from (
      select * from public.words w where w.user_id=auth.uid() and w.archived=p_archived
      and (strpos(lower(w.term),lower(left(p_query,200)))>0 or strpos(lower(w.meaning),lower(left(p_query,200)))>0)
      order by w.created_at desc,w.id limit 30 offset greatest(0,least(p_offset,1000000))
    ) q),'[]'::jsonb));
$$;
create function public.study_stats() returns jsonb language sql stable security invoker set search_path = '' as $$
  with e as (select * from public.review_events where user_id=auth.uid()),
  settings as (select coalesce((select time_zone from public.user_settings where user_id=auth.uid()),'Asia/Seoul') tz)
  select jsonb_build_object(
    'total',count(*),
    'typed_total',count(*) filter(where mode='typed' and not hint_used),
    'typed_correct',count(*) filter(where mode='typed' and not hint_used and correct),
    'assisted_total',count(*) filter(where mode='choice' or (mode='typed' and hint_used)),
    'assisted_correct',count(*) filter(where (mode='choice' or (mode='typed' and hint_used)) and correct),
    'self_total',count(*) filter(where mode='self'),
    'self_good',count(*) filter(where mode='self' and rating='good'),
    'active_words',(select count(*) from public.words where user_id=auth.uid() and not archived),
    'due_words',(select count(*) from public.review_state s join public.words w on w.id=s.word_id and w.user_id=s.user_id where s.user_id=auth.uid() and not w.archived and s.due_at<=now()),
    'fresh_words',(select count(*) from public.words w where w.user_id=auth.uid() and not w.archived and not exists(select 1 from public.review_state s where s.user_id=w.user_id and s.word_id=w.id)),
    'completed_sessions',(select count(*) from public.study_sessions where user_id=auth.uid() and completed_at is not null),
    'days',coalesce((select jsonb_agg(to_jsonb(d) order by d."day" desc) from (
      select to_char(reviewed_at at time zone (select tz from settings),'YYYY-MM-DD') as "day",count(*) as reviews from e
      where reviewed_at >= now()-interval '30 days' group by 1) d),'[]'::jsonb),
    'mistakes',coalesce((select jsonb_agg(to_jsonb(m)) from (
      select id,expected_answer term,answer,reviewed_at from e where correct=false order by reviewed_at desc,id limit 20
    ) m),'[]'::jsonb)
  ) from e;
$$;
-- Functions default to PUBLIC EXECUTE in PostgreSQL: revoke explicitly.
revoke execute on function public.touch_word(), public.normalize_answer(text), public.start_session(),
 public.finish_session(uuid), public.submit_review(uuid,uuid,uuid,integer,integer,text,text,boolean,text),
 public.study_queue(),public.search_words(text,boolean,integer),public.study_stats() from public,anon;
grant execute on function public.start_session(),public.finish_session(uuid),
 public.submit_review(uuid,uuid,uuid,integer,integer,text,text,boolean,text),
 public.study_queue(),public.search_words(text,boolean,integer),public.study_stats() to authenticated;
