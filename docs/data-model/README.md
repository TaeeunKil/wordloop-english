# Data model

| Table | Purpose |
| --- | --- |
| `user_settings` | timezone and daily goal |
| `words` | user's active or archived vocabulary |
| `study_sessions` | open/completed practice sessions |
| `review_events` | append-only response history and receipt |
| `review_state` | current stage, due time, and optimistic version |
| `difficulty_levels` | shared L1–L7 editorial scale and non-equivalent exam guidance |
| `vocabulary_catalog` | shared original sense cards with level, domain and provenance |
| `learning_tracks` | DET 120+, TOEIC L&R 750 and 900 target configurations |
| `catalog_track_rules` | per-card/per-track core, stretch or optional relevance |
| `study_days` | one persisted learner-local plan per calendar day and learning track |
| `study_day_items` | ordered daily word snapshots, including due/fresh/random source and completion |
| `user_ability` | personal adaptive score, level, confidence and evidence count |

The original five tables carry an ownership path to `auth.users`. The migration in `supabase/migrations/202609080001_wordloop_v1.sql` enables RLS, adds least-privilege grants, and defines the session/review/statistics functions. Those functions and ownership policies are unchanged by the catalog addition.

## Catalog migrations

- `20260908120000_vocabulary_catalog.sql`: four shared tables, indexes, read policies, timestamp triggers, and the personal `words` provenance link.
- `20260908120100_vocabulary_catalog_seed.sql`: seven levels, three tracks, 175 original cards (25 per level), and 525 track rules. This is a data migration so an existing installation receives the catalog too. `db.seed` stays disabled.
- `20260908120200_vocabulary_catalog_exp1.sql`: adds 175 original editorial cards (25 per level) and 525 rules, bringing the catalog to 350 cards (50 per level) and 1,050 rules. Uses `wl-exp1-` keys, provenance version `exp1`, and deterministic `e1000000-0000-4000-8000-` UUIDs followed by a two-digit level and ten-digit sequence, verified disjoint from all v1 IDs. Inserts only new shared cards/rules; existing migrations, catalog rows and personal data are preserved.
- `20260908120300_vocabulary_catalog_exp2.sql` and `20260908120400_vocabulary_catalog_exp3.sql`: add 700 original editorial cards (100 per level) and 2,100 rules, bringing the catalog to 1,050 cards (150 per level) and 3,150 rules. Each batch uses a new stable content-key/UUID namespace and inserts only shared content.
- `20260908120500_daily_study.sql`: adds the learner track default and persisted daily plans. `start_daily_session()` imports only the selected active catalog cards that are not already in the learner's collection, chooses them once with randomized ordering, and returns the remaining ordered queue. Due and fresh personal words are considered before catalog cards.
- `20260909130000_adaptive_learner_ability.sql`: adds the per-user adaptive ability profile, auditable ability snapshots on review events, weighted level-aware catalog selection, and the profile privacy policy. It replaces `start_daily_session()` without changing the existing due-first and persisted-day contract.

The versioned source under [`supabase/catalog/expansion-v2`](../../supabase/catalog/expansion-v2/) contains 555 additional original editorial candidates for L1–L5. It is not part of the 1,050-card production baseline and is not imported until a reviewed forward-only migration is added.

`user_ability` is a per-user summary and never changes the shared difficulty assigned to a card. `score` is an internal 0–1000 adaptive value mapped to `ability_level` L1–L7. `confidence` reaches 100% after 20 scored responses; self-ratings do not increase the evidence count. The four ability snapshot columns on `review_events` make each change auditable while preserving the append-only event history.

Migration history is forward-only. Never edit already-applied migrations to refresh content. Add a new migration using the stable `content_key`/ID to update an existing sense; give a different sense a new key. Seed IDs are deterministically derived from permanent version/level/sequence keys. They must not be recomputed when a card changes difficulty. The sequence is not a frequency ranking.

## Sense cards and search

A card is one learnable sense. `book` (책) and `book` (예약하다) have distinct IDs and parts of speech. `normalized_term` and `normalized_meaning` are generated with the existing immutable ASCII case/whitespace normalizer; the pair is unique. Different Korean wording can still describe the same sense, so editorial review must also catch semantic duplicates. Non-ASCII normalization and punctuation folding are not implied.

Each card carries a part of speech, L1–L7 level, editorial CEFR anchor/band, topic/domain/skill arrays, priority (higher first), optional corpus frequency, source, license/provenance, active flag and timestamps. `frequency_rank` is deliberately NULL for all starter cards: there is no measured corpus ranking. A non-null rank requires a named frequency source. Skills are content-use tags, not estimated subtest scores or a claim that audio exercises are implemented.

Indexes cover active level/priority selection, normalized exact/prefix lookup, simple-token full-text search over term/meaning/example, topics, and domains. The `simple` full-text configuration supports token lookup, not Korean morphology or arbitrary substring search. Use `to_tsvector('simple', term || ' ' || meaning || ' ' || example)` for matching the search expression index; add trigram support only if substring search later needs it.

Track rules use a composite key `(catalog_id, track_id)` with role, priority, positive weight, rationale and timestamps. Current rules are transparent editorial defaults. The weights are relative ranking multipliers, not probabilities or daily quotas. Each of the 1,050 cards has one rule for each of the three tracks (3,150 rules); optional cards are fallback candidates, not a requirement to study every level.

## Personal snapshots and access

`words.catalog_id` is nullable; `origin` defaults to `custom`. A check requires custom words to have no link and catalog words to have a link. A partial unique index on `(user_id, catalog_id)` prevents duplicate imports, including archived copies. Restore the existing personal card instead of inserting another copy.

On future import, copy `term`, `meaning`, and `example` into `words` and initialize `note` separately. Later catalog edits never propagate to these personal fields. Existing personal update grants remain unchanged; provenance can be set at insert time but cannot be relinked through ordinary client updates. Existing rows become `custom` with a NULL catalog link without triggering a word version bump. The existing word trigger still increments versions for actual personal edits.

Referenced catalog cards cannot be hard-deleted (`ON DELETE RESTRICT`). Retire them with `is_active=false`; personal snapshots and review history remain readable. A foreign key is an identity constraint, not active-card validation: `start_daily_session()` selects active cards inside the same security-definer transaction before copying them. The RPC is serialized per user, so concurrent starts cannot create two plans for the same local day.

All shared tables have RLS. Authenticated users can read levels, active cards, active tracks, rules whose parents are active, and their own daily plan rows. Anonymous reads and ordinary authenticated writes are denied. Maintenance uses migrations or an authorized server-only administrative connection. The daily planner is the only new privileged RPC exposed to authenticated users; it performs ownership checks and per-user serialization before importing or selecting rows. The existing user ownership policies and column grants continue protecting personal vocabulary.

## Validation

`npm test -- tests/catalog.test.ts` executes the actual v1, catalog, seed and exp1 migrations in the installed PGlite PostgreSQL runtime. It checks 350 cards, 50 per level, no duplicate normalized term/meaning pairs, 1,050 track rules, required fields, all three tracks, valid roles, RLS/grants, retirement, snapshot preservation, duplicate imports, and the original review RPC's idempotency/stale-version behavior using synthetic users. Expansion checks cover exactly 175 additions, deterministic IDs without v1 collisions, level metadata, provenance, unchanged existing shared rows, and the original editorial role/domain logic. The daily migration is verified separately against a clean migrated database because it extends the personal study flow. All content migrations insert only shared data. It runs in `npm run verify` through the existing test command.

PGlite stubs `auth.users`/`auth.uid()` and roles; it is not a connected Supabase, OAuth or PostgREST test. With Docker and the local Supabase stack available, run `npm run db:reset` and `npm run verify:db` as the repository guide requires. Do not run a reset against a remote database. Applying these files to production is a separate deployment step.

See [the catalog decision](../decisions/0002-shared-vocabulary-catalog.md) for levels, guidance sources and the future daily-session contract.
