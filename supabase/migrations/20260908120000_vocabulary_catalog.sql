-- Shared learning content only. Existing review RPCs and ownership policies stay intact.
create table public.difficulty_levels (
  code text primary key check (code ~ '^L[1-7]$'),
  ordinal smallint not null unique check (ordinal between 1 and 7),
  label text not null check (length(btrim(label)) > 0),
  cefr_anchor text not null check (cefr_anchor in ('A1','A2','B1','B2','C1','C2')),
  cefr_band text not null check (length(btrim(cefr_band)) > 0),
  description text not null,
  exam_guidance text not null,
  guidance_is_heuristic boolean not null default true check (guidance_is_heuristic)
);

create table public.vocabulary_catalog (
  id uuid primary key default gen_random_uuid(),
  content_key text not null unique check (content_key ~ '^[a-z0-9][a-z0-9_-]{2,99}$'),
  term text not null check (length(btrim(term)) between 1 and 200),
  normalized_term text generated always as (public.normalize_answer(term)) stored,
  meaning text not null check (length(btrim(meaning)) between 1 and 2000),
  normalized_meaning text generated always as (public.normalize_answer(meaning)) stored,
  example text not null check (length(btrim(example)) between 1 and 3000),
  part_of_speech text not null check (part_of_speech in ('noun','verb','adjective','adverb','phrase','preposition','conjunction','pronoun','determiner','interjection')),
  difficulty text not null references public.difficulty_levels(code),
  cefr_anchor text not null check (cefr_anchor in ('A1','A2','B1','B2','C1','C2')),
  cefr_band text not null check (length(btrim(cefr_band)) > 0),
  topics text[] not null check (cardinality(topics) > 0 and array_position(topics,null) is null and not ('' = any(topics))),
  domains text[] not null check (cardinality(domains) > 0 and array_position(domains,null) is null and domains <@ array['general','academic','workplace']::text[]),
  skills text[] not null check (cardinality(skills) > 0 and array_position(skills,null) is null and skills <@ array['literacy','production','comprehension','conversation','toeic_listening','toeic_reading']::text[]),
  frequency_rank integer check (frequency_rank > 0),
  frequency_source text,
  priority smallint not null default 50 check (priority between 0 and 100),
  source text not null check (length(btrim(source)) > 0),
  license text not null check (length(btrim(license)) > 0),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object' and provenance ?& array['method','version']),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_sense_unique unique(normalized_term, normalized_meaning),
  constraint catalog_frequency_provenance check (frequency_rank is null or (frequency_source is not null and length(btrim(frequency_source)) > 0))
);
create index catalog_level_priority on public.vocabulary_catalog(difficulty,priority desc,id) where is_active;
create index catalog_term_prefix on public.vocabulary_catalog(normalized_term text_pattern_ops);
create index catalog_search on public.vocabulary_catalog using gin
  (to_tsvector('simple'::regconfig, term || ' ' || meaning || ' ' || example));
create index catalog_topics on public.vocabulary_catalog using gin(topics);
create index catalog_domains on public.vocabulary_catalog using gin(domains);

create table public.learning_tracks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  label text not null check (length(btrim(label)) > 0),
  exam text not null check (exam in ('DET','TOEIC_LR')),
  target_score integer not null,
  core_level text not null references public.difficulty_levels(code),
  stretch_level text not null references public.difficulty_levels(code),
  description text not null,
  exam_guidance text not null,
  guidance_is_heuristic boolean not null default true check (guidance_is_heuristic),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((exam = 'DET' and target_score between 10 and 160 and target_score % 5 = 0)
    or (exam = 'TOEIC_LR' and target_score between 10 and 990 and target_score % 5 = 0))
);
create table public.catalog_track_rules (
  catalog_id uuid not null references public.vocabulary_catalog(id) on delete cascade,
  track_id uuid not null references public.learning_tracks(id) on delete cascade,
  role text not null check (role in ('core','stretch','optional')),
  priority smallint not null check (priority between 0 and 100),
  weight numeric(5,2) not null check (weight > 0 and weight <= 100),
  rationale text not null check (length(btrim(rationale)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(catalog_id,track_id)
);
create index track_recommendation on public.catalog_track_rules(track_id,role,priority desc,catalog_id);

create function public.touch_catalog_timestamp() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
revoke execute on function public.touch_catalog_timestamp() from public,anon,authenticated;
create trigger catalog_touch before update on public.vocabulary_catalog for each row execute function public.touch_catalog_timestamp();
create trigger tracks_touch before update on public.learning_tracks for each row execute function public.touch_catalog_timestamp();
create trigger track_rules_touch before update on public.catalog_track_rules for each row execute function public.touch_catalog_timestamp();

-- Catalog cards are retired, not deleted while referenced. Personal snapshots stay editable.
alter table public.words
  add column catalog_id uuid references public.vocabulary_catalog(id) on delete restrict,
  add column origin text not null default 'custom' check (origin in ('custom','catalog')),
  add constraint words_catalog_origin check ((origin = 'custom' and catalog_id is null) or (origin = 'catalog' and catalog_id is not null));
create unique index words_owner_catalog_unique on public.words(user_id,catalog_id) where catalog_id is not null;
create index words_catalog_reference on public.words(catalog_id) where catalog_id is not null;
-- Import happens at INSERT. Existing column UPDATE grants do not permit relinking a card.
grant insert(catalog_id,origin) on public.words to authenticated;

alter table public.difficulty_levels enable row level security;
alter table public.vocabulary_catalog enable row level security;
alter table public.learning_tracks enable row level security;
alter table public.catalog_track_rules enable row level security;
revoke all on public.difficulty_levels,public.vocabulary_catalog,public.learning_tracks,public.catalog_track_rules from public,anon,authenticated;
grant select on public.difficulty_levels,public.vocabulary_catalog,public.learning_tracks,public.catalog_track_rules to authenticated;
create policy levels_read on public.difficulty_levels for select to authenticated using (true);
create policy catalog_active_read on public.vocabulary_catalog for select to authenticated using (is_active);
create policy tracks_active_read on public.learning_tracks for select to authenticated using (is_active);
create policy track_rules_active_read on public.catalog_track_rules for select to authenticated using (
  exists (select 1 from public.vocabulary_catalog c where c.id = catalog_id and c.is_active)
  and exists (select 1 from public.learning_tracks t where t.id = track_id and t.is_active)
);

comment on table public.vocabulary_catalog is 'Shared editorial sense cards; CEFR and WordLoop levels are estimates, not learner mastery or exam equivalence.';
comment on column public.words.catalog_id is 'Provenance link only. term/meaning/example/note remain independent personal snapshots.';
comment on column public.vocabulary_catalog.frequency_rank is 'NULL until backed by a named corpus; editorial priority is not empirical frequency.';
