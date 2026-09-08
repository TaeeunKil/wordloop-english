# Architecture overview

WordLoop is a root-level Next.js App Router application deployed to Vercel. Private pages and server actions use the Supabase SSR client, with cookies refreshed by `src/proxy.ts`. Google and GitHub OAuth create the session. PostgreSQL is the only durable store.

The browser sends a proposed review response. The `submit_review` database function authenticates the caller, locks the user's review stream, checks word/state versions, calculates correctness and due time, appends the event, and updates the state in one transaction. RLS protects direct table reads and RPCs are explicitly granted.

The blog repository is intentionally outside this runtime. Its only integration should be a link to the Vercel URL, keeping publishing and study data independent.

The shared vocabulary foundation consists of `difficulty_levels`, `vocabulary_catalog`, `learning_tracks`, and `catalog_track_rules`. Authenticated users read active shared content; maintenance writes are administrative. A catalog card is imported atomically as a personal `words` snapshot with provenance when a daily plan needs it. Personal mastery remains in `review_state`; shared content difficulty and target exam relevance are separate concepts.

The starter data plus the exp1, exp2 and exp3 expansions contains 1,050 original cards, 150 per L1–L7, and 3,150 rules across three preparation tracks. Exam guidance is heuristic, never a score prediction. `start_daily_session()` creates one learner-local daily plan, puts due personal reviews first, then fresh personal words, and fills the remaining goal from a persisted random selection of the active learning track. The existing review RPC remains the source of truth for correctness and scheduling. See [data model](../data-model/README.md), [decision 0002](../decisions/0002-shared-vocabulary-catalog.md), and [decision 0003](../decisions/0003-vocabulary-quality-and-review-scheduling.md).
