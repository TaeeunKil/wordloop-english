# 0003 — Vocabulary quality and daily review scheduling

Status: proposed; design only. Version: 1.0, 2026-09-08. Baseline inspected: `9f99cf6` (350 catalog cards). Builds on [ADR-0002](0002-shared-vocabulary-catalog.md); refines its future queue contract. No schema, scheduler, catalog content, or production change is enacted by this document. Future material design changes should record a dated revision here or a superseding ADR.

## Decision and evidence boundary

Separate editorial content difficulty, preparation relevance, and personal recall state. Grow toward 300 **sense cards** per level (2,100 total), subject to quality gates. Counts are inventory goals, not evidence of vocabulary coverage, CEFR attainment, or 2,100 distinct headwords. Implement reliable daily selection before introducing an adaptive scheduler. Keep the current fixed scheduler as the initial baseline; evaluate a pinned FSRS implementation in shadow mode before enabling it.

All numeric quality thresholds, quotas, mastery criteria, and rollout gates below are proposed WordLoop operating defaults, not research-established cutoffs. The current repository and cited primary sources support the distinctions and design constraints; they do not validate this app's learning effectiveness. This inspection did not query hosted Supabase or rerun its deployment verification.

## What exists today

| Inspected component | Implemented behavior and limitation |
| --- | --- |
| Catalog schema + seed + exp1 migrations | Seven levels, 350 cards/50 per level, three tracks, 1,050 rules. One sense per row, normalized term/meaning uniqueness, POS, CEFR metadata, domains, topics, skills, provenance, active status. All frequency ranks are NULL. `review_status` says initial editorial pass, not independently calibrated. |
| `words` | Editable personal snapshots with optional `catalog_id`; one import per user/catalog ID, including archived copies. Catalog retirement preserves snapshots. No atomic recommendation/import RPC yet. |
| `user_settings` | Timezone and `daily_goal` (default 20, range 1–200). No target profile, new-card budget, or scheduler preference. |
| `start_session()` / `finish_session()` | One open session per user, serialized with the same per-user advisory lock as reviews; start reuses the open ID, finish is repeatable. No daily identity, item snapshot, or required completion count. |
| `study_queue()` / `startStudy()` | Up to 20 active personal words, reviewed due items ordered by `due_at`, then fresh words, with creation time/ID ties. No catalog selection or daily-goal enforcement. The action calls start and queue separately; refresh can change the list. |
| `submit_review(...)` | Authenticates, serializes, checks ownership/open session/word and state versions/due time, computes correctness, writes event and state atomically. Exact event-ID replay returns its original receipt; changed payload conflicts. Does not require membership in a persisted session queue. |
| Scheduling | Unassisted correct typed answers advance stages 0–7 using 1/3/7/14/30/60/120-day intervals. Failure resets stage to 0. Successful choice, hint-assisted, and self-good responses preserve stage but schedule ten minutes, as do failures. `lapses` counts failed responses, including initial learning and self-again; it is not a clean count of mature-memory lapses. |
| Assessment / analytics | Typed and choice answers compare to `words.term` using ASCII case/whitespace normalization; punctuation matters. No sense-specific alternate-answer model. `study_stats()` separates typed, assisted, and self responses, counts all events for activity, and returns 30-day activity plus 20 recent incorrect typed/choice events. |
| Tests | `tests/catalog.test.ts` executes migrations and RPC regressions in PGlite with stubbed Auth; covers counts, structural quality, provenance, permissions, preservation, duplicate imports, replay and stale/due checks. Validation/calendar tests cover input, options and dates. These do not establish linguistic quality, real multi-connection races, hosted authorization, or retention benefit. |

Source of truth for this inventory: [v1 RPC migration](../../supabase/migrations/202609080001_wordloop_v1.sql), [catalog schema](../../supabase/migrations/20260908120000_vocabulary_catalog.sql), [catalog tests](../../tests/catalog.test.ts), [study actions](../../src/app/actions.ts), and [study rules](../architecture/study-rules.md). The versioned [`expansion-v2` source](../../supabase/catalog/expansion-v2/) contains 555 L1–L5 candidates and is not part of the 1,050-card production baseline until a reviewed migration promotes it.

## Seven-level editorial framework

The Council of Europe's CEFR describes communicative competence through descriptors, rather than prescribing a universal word-to-level lookup. Vocabulary range and control include breadth and appropriate use. Use these as anchors, with task and sense context; a difficult example alone must not make an otherwise basic sense advanced. See the [2020 Companion volume, vocabulary range/control, printed pp. 131–132](https://rm.coe.int/common-european-framework-of-reference-for-languages-learning-teaching/16809ea0d4).

The following are WordLoop's operational interpretations, preserving existing anchors and overlapping bands:

| Level | Existing anchor / band | Evidence an editor should demonstrate for the particular sense |
| --- | --- | --- |
| L1 | A1 / A1–A2 | Concrete referents and routine actions; literal sense; simple everyday frame. Avoid specialist background assumptions. |
| L2 | A2 / A2 | Common requests, movement, schedules and experiences; familiar complements or everyday multiword expressions. Distinguish practical contrasts such as borrow/lend. |
| L3 | B1 / B1 | Explain reasons and experiences; accessible abstract relations; common collocations in connected everyday discourse. |
| L4 | B2 / B1–B2 | Compare, organize and interpret information; routine academic/workplace meanings; select among plausible alternatives using context. |
| L5 | B2 / B2 | Express evidence, argument and precise process distinctions across contexts; constrained collocations or less transparent senses. |
| L6 | C1 / B2–C1 | Infer nuanced abstract relationships; manage register, stance and near-synonyms; justify a distinction beyond general B2 expression. |
| L7 | C1 / C1–C2 | Fine semantic/pragmatic distinctions, marked idiom or precise formal use; specialist senses only when transferable and explained. Rare spelling alone is insufficient. |

For each card, retain a five-axis editorial record scored 0–3, with short evidence notes: exposure/context breadth (broad routine → narrow), semantic abstraction/nonliteralness, collocational/grammatical constraints, polysemy/near-synonym discrimination, and register/pragmatic constraints. Record orthographic/morphological burden separately; do not equate long words with advanced competence. Unknown exposure is **unknown**, not a high rarity score. These are review prompts, not a summed formula that automatically assigns L1–L7.

Compare every candidate with two approved sense exemplars at the intended level and one at each available neighboring level. An editor explains why the target level fits; the checker independently labels it before seeing that rationale. Disagreement of more than one level, missing evidence, or low confidence requires adjudication. Initially build a 10-card anchor set per level from the existing 350, checking every anchor independently. Track exact and adjacent-level agreement; persistent systematic disagreement means revising the rubric, not averaging labels. Each card records rubric version, confidence (low/medium/high), reviewer identity/type, and unresolved issues. AI agreement is not independent human or empirical calibration.

### Balance, identity and examples

Use one editorial `primary_domain` for counting even when `domains[]` has multiple tags. Initial per-level balance targets are general/academic/workplace: L1–L2 70/10/20%, L3–L4 45/25/30%, L5–L7 30/35/35%, with ±10 percentage-point review tolerance. These targets are curriculum choices. Do not tag a basic object as intrinsically advanced because its example occurs in an office. Use neutral register for at least 70% of L1–L4 and 50% of L5–L7; explicitly label informal, formal, technical and dated usage. Flag any topic exceeding 20% of a level, and any narrow specialist topic exceeding 10%. Prefer useful coverage over artificial quota padding; document exceptions.

- Keep permanent IDs/content keys across spelling corrections and releveling. Same lemma/POS/sense with a reworded Korean gloss is a duplicate, even if the SQL unique constraint accepts it. Inflections and spelling variants belong to one sense unless a distinct lexical meaning warrants another card.
- Different senses/POS may share a headword, as existing `book` cards do. Add an editorial lemma key, stable sense key, variant links and optional canonical duplicate link. Never delete/relink a learner's history when merging editorial duplicates; retire the redundant entry, suppress future duplicate introduction, and retain existing snapshots.
- A semicolon may join equivalent translations, not unrelated senses. For example, exp1's `rice` gloss “쌀; 밥” needs explicit review of intended scope and prompt ambiguity; this observation is a review flag, not a correction applied here.
- Require natural grammar, matching POS/sense, plausible collocation, accurate Korean meaning, and one clear learning target. Flag missing target/inflected form, wrong sense, circular definitions, unsupported facts, copied text, and template repetition. Automatic flags require linguistic review rather than blind substring rejection.
- Suggested example lengths are 5–12 tokens for L1–L2, 8–18 for L3–L5, and 10–25 for L6–L7. Flag unfamiliar non-target vocabulary and dense syntax; allow documented exceptions. A short high-level example is fine if it isolates a subtle sense.
- A Korean gloss alone can admit several English synonyms. A future assessment prompt should add disambiguating context/POS or approved acceptable forms; do not penalize a valid synonym merely because today's exact matcher rejects it. Keep examples visible as feedback/hints, or mask target variants in an explicitly designed cloze mode. The present client displays the full example after a hint; it is not an unaided cloze exercise.
- Recognition distractors should match POS and be plausible but clearly wrong for that sense. Inflections, synonyms, or another valid sense must not become accidental wrong choices. Existing random personal-term options do not implement this check.

### Provenance and release workflow

Use `draft → automated_checked → editorial_checked → approved → retired`, with `needs_revision` returning to draft. At present only `is_active` and free-text provenance exist; do not relabel all active cards “approved.” Mark the existing 350 as legacy provisional until audited.

Generation records the tool/model and version when known, date, batch, author type, original-content method and source references. Never invent missing model/reviewer information. Preserve original gloss/example authorship and license separately from sources consulted for level judgments. `LicenseRef-WordLoop-Original` is the current internal content label, not proof of an external license. Measured frequency requires corpus name, release, license, unit (lemma/sense/token) and coverage; do not fill `frequency_rank` from intuition.

Before release, check every candidate for structural constraints, semantic duplicates across all batches, meaning/example correctness and level rationale. A checker other than the generator reviews every card; a responsible editor adjudicates flagged/low-confidence cards and audits at least 10% per level/batch. Record whether each check was human or AI. If no human review occurred, label that accurately and offer it only as provisional content; no claim of human approval. Any critical meaning, answer or rights defect in an audit blocks the affected batch pending a full recheck of that failure category.

For the 2,100-card goal, the remaining 1,750 cards can arrive in five 350-card batches, nominally 50 per level per batch. Deliver stable keys, content, rubric evidence, duplicate decisions and a quality report with each batch. Releveling may unbalance the totals: replace the gap with a suitable candidate rather than keep a wrong label. Report generated, approved, provisional and active counts separately. Store proposed fields in a versioned editorial manifest until a forward-only schema migration introduces them; generation alone does not authorize promotion under this policy.

### Exam labels and calibration

Keep `guidance_is_heuristic=true`, and display “학습 방향 참고 · 공식 점수 환산 아님” wherever exam targets accompany levels. DET's official B2 range is 100–125 and C1 is 130–150; those describe the full test, not WordLoop performance. [Official DET alignment](https://blog.englishtest.duolingo.com/duolingo-test-aligned-with-cefr/) supports this distinction. ETS publishes section-specific TOEIC L&R thresholds; a total target such as 750 or 900 cannot establish a balanced CEFR skill profile. See [ETS mapping](https://www.ets.org/pdfs/toeic/toeic-mapping-cefr-reference.pdf).

Keep DET L5 core/L6 stretch and the existing TOEIC multi-level rules as editorial defaults. `catalog_track_rules` is the authority for multi-level core coverage, not just the single `learning_tracks.core_level`. Never derive a predicted test score, guaranteed result, or CEFR certificate from card count, streak, accuracy or mastery. Learners may choose a lower start level without changing their exam target.

Collect within-person, mode-separated delayed recall and ambiguity reports first. Difficulty reports must control for exposure, delay, hint use, proficiency and prompt revision before suggesting releveling. A single person's errors cannot calibrate a population scale. Prefer editorial reassessment over automatic global relabeling; later multi-learner calibration requires an appropriate sampling and validation study.

## Daily selection and persistence plan

Introduce `start_daily_session_v2(request_id)` that uses the existing per-user lock to atomically read the profile, create/reuse a study day, reserve budgets, import eligible content and snapshot ordered items. Persist a daily window with timezone/local date and UTC start/end. Reuse an unfinished session; never rebuild it on refresh. One daily plan may contain several short sessions, all sharing the same budgets. Timezone changes apply at the next window boundary, with contiguous windows so changing zones cannot replenish today's allowance. Keep elapsed scheduling in UTC, distinct from local activity dates.

Proposed default: 20 distinct daily cards (`daily_goal`), at most five introductions/day, 20 items per session, and a soft ten-minute stop suggestion. Existing users with goals up to 200 keep their daily setting but work in chunks. The server enforces daily limits; an explicit extra-review action may extend due-only practice, never silently add new cards. A duplicate receipt does not consume budget. A paused/resumed session keeps its reservations; cancellation releases unpresented reservations transactionally and never resets completed counts.

At planning time let C be remaining daily distinct-card capacity and D the count of eligible reviewed/due personal cards. Select up to `min(C,D)` due cards first; introductions have budget `min(remaining_new_limit, max(0,C-D))`. Unreviewed personal cards also count as introductions. Thus a backlog occupying the whole budget suppresses new cards. Small queues remain small when the new limit is reached; do not fill with not-yet-due work.

| Selection group | Proposed ordering / limits |
| --- | --- |
| Due personal words, including due mistakes | Oldest `due_at` first. Use recent unaided failure, then ID as ties. No exam/level/domain filter may hide an already learned due card. |
| Fresh personal words | Use up to half of available new slots when catalog candidates also exist; oldest first, ID tie. Allow either source to fill shortages. Explicitly learner-pinned additions may take precedence. |
| Unseen approved catalog senses | Core first, at most 20% of catalog introduction slots as stretch over a rolling five-study-day window. Zero stretch with a due backlog, or until 20 delayed unaided attempts exist and at least 80% were correct over the latest 14 days. These conservative gates are heuristics. |
| Optional/foundation senses | Only within the learner's selected level range or explicit foundation choice. Exhaustion offers a level choice or an empty state, never silently advances to L7. |

Deduplicate by personal word and canonical catalog sense before reserving slots. Exclude archived imports, suspended items, inactive/unapproved catalog entries and already introduced senses. Restoration of an archived card is an explicit action. New-card sibling senses sharing a lemma are introduced on different study days to reduce answer cueing; due siblings may both appear but are separated in the display order when feasible.

Within the eligible new pool, honor role quotas first. Use existing rule weight as the relevance factor (currently core 1, stretch .35, optional .1, with existing domain multipliers), multiplied by a bounded 0.5–2 coverage factor based on the deficit in the permitted level/primary-domain distribution over the last 50 introductions. Track priority and catalog priority break ties. For variety, use deterministic weighted sampling without replacement (`-ln(U)/weight`, smallest first), with U derived from the stored daily seed and candidate ID. Store selected weight/reason/versions, not just the result. Do not apply the existing domain multiplier twice. Soft coverage targets relax on shortages and log the reason.

Fairness means coverage among eligible new material and no forgotten due backlog, not equal study of all seven levels. After snapshot selection, avoid more than three consecutive same-domain items where alternatives exist; do not change membership or exceed budgets. Report overdue age and per-domain waiting time. With an always-overloaded queue, no ordering can guarantee bounded waiting; reduce introductions and offer manageable extra due sessions rather than claim starvation is solved.

## Recall, relearning and mastery

First ship versioned `fixed_v2` behavior with the existing successful typed interval ladder. Keep `stage` as a scheduler compatibility field, not a proficiency level. Preserve the current result receipt fields while adding explicit assessment outcome, scheduling reason and algorithm version.

| Observation | Proposed fixed_v2 scheduling and mastery evidence |
| --- | --- |
| Correct typed, no answer/help exposure | Advance one stage as today. Eligible for durable mastery only at a delayed, distinct-day assessment. |
| Wrong unaided typed or self-again | Stage 0, relearning due in ten minutes. Record actual failure; self reports remain distinct in analytics. |
| Correct after hint, choice, or self-good | No mastery advance. Schedule one later unaided check at ten minutes; do not repeatedly cycle guided success. After a second assisted attempt that day, offer explanation and defer the check for 24 hours. |
| Wrong assisted/choice | No durable success; record assisted failure and use bounded relearning. Keep separate from unaided failure statistics and mature lapses. |
| Skipped, ambiguous/defective item, interrupted before submission | No inferred failure or review event. Record item disposition; preserve recall state. Correct defects through editorial review. |

Allow at most two scored attempts per word/day, including the first assessment. A retry can only run when due and after at least three other items if available; otherwise offer a later return rather than a waiting screen. Retries are child items appended idempotently to the snapshot, up to five retries/session. They consume an attempt budget but not another distinct-card goal slot. When limits are hit, set an explicit eligibility deferral until the next study day while retaining the underlying `due_at`; show it as deferred, not remembered. Optional immediate practice is unscored and cannot bypass these limits.

Proposed durable mastery states: `new → learning → consolidating → maintained`; failure after consolidation leads to `relearning`. Two unaided successes on distinct study days move learning to consolidating. Maintained requires at least four qualifying successes on distinct days, an actual successful recall after at least 30 elapsed days, and no unaided failure since the current qualifying run began. Relearning returns to consolidating after two new distinct-day unaided successes; maintained must be earned again. Maintained cards still have due dates; overdue alone does not prove forgetting. Answer exposure, same-day repetition and self-good cannot satisfy these gates. Meaning-changing personal edits invalidate the qualification run; note-only edits do not, although the existing word-version check still applies.

A leech candidate has unaided failures on four distinct study days within the last 14 days. Flag for ambiguity, overloaded meaning, confusing sibling, spelling issue, or inappropriate level; do not count repeated same-day attempts as separate failure days. After six failed days in that window, pause automatic scheduling and surface a repair/resume action. Suspension is reversible, separate from archival and mastery, and preserves events and due dates. Resume after correction/explanation with one scheduled relearning check. Thresholds are versioned product defaults and should be adjusted from observed burden.

## Adaptive scheduler evaluation

FSRS models memory using stability, difficulty and time-dependent retrievability; its per-card difficulty is not WordLoop L1–L7. Its upstream algorithm has multiple versions: select and pin one implementation/version with reference-vector tests, rather than mixing formulas. [Upstream algorithm documentation](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm) is the technical reference. Begin with default parameters and a proposed desired retention of .90; higher retention increases workload, so it is not a guarantee to display to learners. [Anki's FSRS guidance](https://docs.ankiweb.net/deck-options.html#fsrs) describes this tradeoff and migration considerations.

Run a server-only scheduler adapter in shadow mode: map only valid unaided typed failures/successes to Again/Good initially. Do not fabricate Hard/Easy from latency, map hints to successful recall, or reinterpret old choice/self-good events as memory successes. Track guided exposures separately; they affect recall and limit the validity of an FSRS model trained only on unaided events. If that exposure mismatch is material in evaluation, retain fixed_v2 rather than assume native Anki defaults transfer. A separate learning/relearning step controls guided attempts.

Store predicted recall before the answer and the shadow next state after it. No per-level parameter fitting for this small personal dataset. Consider user-specific fitting only after at least 500 eligible delayed observations over 60 days and sufficient chronological holdout data; these are readiness heuristics, not universal sample-size requirements. Evaluate held-out calibration/Brier or log loss, workload and delayed recall, not training fit. Shadow predictions alone cannot prove the benefit of intervals that were never used.

Enable by cohort/profile flag only after replay, security and workload checks. Preserve existing due dates at switch; initialize/replay an explicitly versioned state from eligible history and use the new interval after the next genuine due review. Missing history is marked cold-start, never reconstructed as invented successes. Initially cap adaptive intervals at the current 120-day maximum. Rollback disables future adaptive scheduling while preserving events, receipts and already assigned dates; seed a documented conservative fixed state at the next due review instead of treating FSRS values as legacy stages.

## Proposed storage and RPC boundaries

Names below are a migration plan, not existing relations or callable APIs.

| Change | Required contract |
| --- | --- |
| Catalog revision/review metadata | Add rubric/content revision, review status, confidence, primary domain, register and lemma/sense identity; retain evidence and review actions in append-only revision/review records. Keep generator provenance separate from approval. Recommendation reads only eligible status; catalog corrections never silently rewrite personal snapshots. |
| `learning_profiles` | Owner-keyed track, start/allowed levels, new limit, stretch preference, queue/scheduler version and retention setting. Profile changes apply to the next plan. |
| `study_days` | Owner, local date/timezone, UTC window, budget/reservations, selection seed, profile version. Unique owner/window identity with no overlapping windows under the user lock. |
| `study_sessions` + `study_session_items` | Link session to day; store status including abandoned, ordinal, word/catalog revision, expected word/state versions, prompt/answer snapshot, reason, selection weights, disposition and optional retry-parent/attempt number. Composite owner/session/word foreign keys; unique ordinal and retry attempt identity. |
| `review_state` extension | Preserve stage/version/reviews/lapses; add mastery state, qualifying streak, mature lapse count, suspended/reason, deferred-until, scheduler/version and validated algorithm state (stability/difficulty/last interval where applicable). Compute retrievability for a timestamp, not as a timeless stored value. |
| `review_events` extension | Append session-item ID, assessment and prompt revision, server exposure classification, scheduling outcome, algorithm/parameter version, pre/post state and pre-answer prediction. Preserve original request/receipt. Never reinterpret existing `lapses` in place. |
| Private scheduler proposals | For future server-library scheduling, bind a single-use computed result to authenticated user, item, event ID, expected versions, server-issued time and algorithm version. Expire/recompute proposals on conflict. Never accept client-supplied due times or state. |

For fixed_v2, keep computation in a security-definer transaction behind explicit execute grants and an empty search path. For future FSRS library integration, a trusted server verifies the user's Supabase session and derives their identity, reads the versioned state, computes via the pinned adapter, then invokes a narrow private commit RPC available only to the server role. That RPC repeats ownership, item, due, budget, version, proposal and outcome consistency checks under the same lock and writes everything atomically. Do not expose this privileged endpoint directly or accept an arbitrary user ID from the browser. This additional trust boundary needs dedicated tests before activation; it is not needed for the first daily-queue release.

For either version, check a prior `(user_id,event_id)` receipt before mutable session/item/due checks, so a successful request still replays after closure or retirement. Include item/assessment identity in the immutable request fingerprint. Same ID/different payload conflicts; two different IDs for one consumed item produce at most one event. Queue reservation, import, submission, finish and retry insertion share the per-user lock order. Invalid/failed transactions consume no budget. Enforce RLS on all owner tables and explicit grants on every new RPC; catalog maintenance stays administrative.

Store prompt snapshots for resume, but reject submission if the personal word or review version changed. Mark the item invalidated and refresh/reissue it explicitly using current data; do not grade a stale prompt against a new answer. Catalog-only revisions do not invalidate an independent personal snapshot. `finish_session_v2` closes with completed/skipped/invalidated counts; finishing early preserves recorded answers and unused work, and must not award full completion. Legacy and v2 routes must dispatch by the server-owned profile/version so old callers cannot bypass daily budgets.

## Analytics and rollout gates

Extend statistics without conflating activity with memory. Report distinct practiced cards, introductions, due completed/remaining, attempts, guided exposures, deferred/suspended cards, oldest overdue age, session completion/abandonment, and delayed unaided recall with numerator/denominator and elapsed-delay buckets. Separate first learning from mature lapses and typed recall from recognition/self-report. Use immutable event content/level/domain revisions for historical comparisons, not the catalog's current label. Activity/streak can acknowledge any accepted practice response; label it participation, not mastery. Avoid storing raw answers in external telemetry; use owner-scoped aggregates.

| Milestone | Concrete deliverable and exit evidence |
| --- | --- |
| M0: editorial baseline | Audit 70 anchors, annotate legacy provisional status, publish rubric and batch review report. Expansion inventory may proceed independently; automated count/ID/provenance checks never substitute for release review. |
| M1: daily queue | Add profile/day/items and atomic import/start/resume while retaining fixed_v1 intervals. Verify same request and concurrent starts produce one plan/import, due-first selection and exhaustion work, level/domain bounds are explainable, and timezone/midnight/goal changes cannot reset budgets. |
| M2: bounded fixed_v2 | Add exposure classification, retry caps, mastery, leeches and item-based submit/finish. Test every mode/outcome, stale edit, due boundary, abandoned session and cap reservation path. UI and old API paths must use the same enforcement. |
| M3: FSRS shadow | Pin dependency and parameter version; pass reference vectors, replay and multi-connection race tests. Collect chronological predictions and exposure-aware diagnostics; publish gaps and burden estimates. No automatic enable based solely on reaching 500 events. |
| M4: opt-in adaptive pilot | Start with the owner, preserve dates and compare an observed baseline period with the pilot, noting practice/content confounding. Initial stop gates: any unauthorized/duplicate state mutation, unexplained state divergence, or a >25% sustained increase in seven-day review burden without a deliberate retention change. Low data or wide uncertainty means extend evaluation, not claim improvement. |

Database milestones require forward-only migrations and regression coverage preserving existing catalog/snapshots/RLS/replay semantics. Run the repository's actual `npm test`, `npm run verify`, and, with Docker available, local `npm run db:reset` plus `npm run verify:db` before release. Add real PostgreSQL multi-connection tests and connected Supabase checks; PGlite alone cannot certify races, PostgREST or OAuth. These are future acceptance checks, not results claimed by this design task. Use version/feature rollback, never delete review history or rewrite applied migrations.

## Revision history

- 1.0 — 2026-09-08: inspected the committed 350-card foundation and current study flow; proposed editorial gates, persisted daily selection, bounded fixed scheduling and staged adaptive evaluation. Source links checked on this date. Implementation and deployment remain separate work.
