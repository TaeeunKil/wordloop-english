# Architecture overview

WordLoop is a root-level Next.js App Router application deployed to Vercel. Private pages and server actions use the Supabase SSR client, with cookies refreshed by `src/proxy.ts`. Google and GitHub OAuth create the session. PostgreSQL is the only durable store.

The browser sends a proposed review response. The `submit_review` database function authenticates the caller, locks the user's review stream, checks word/state versions, calculates correctness and due time, appends the event, and updates the state in one transaction. RLS protects direct table reads and RPCs are explicitly granted.

The blog repository is intentionally outside this runtime. Its only integration should be a link to the Vercel URL, keeping publishing and study data independent.

The shared vocabulary foundation consists of `difficulty_levels`, `vocabulary_catalog`, `learning_tracks`, and `catalog_track_rules`. Authenticated users read active shared content; maintenance writes are administrative. A catalog card represents one meaning and can later be imported as a personal `words` snapshot with provenance. Personal mastery remains in `review_state`; shared content difficulty and target exam relevance are separate concepts.

The starter data plus the exp1 expansion contains 350 original cards, 50 per L1–L7, and 1,050 rules across three preparation tracks. Exam guidance is heuristic, never a score prediction. The current study flow is unchanged: automatic recommendations, onboarding and persistent daily queue items are not yet implemented. Future sessions must snapshot their ordered selection once and honor the existing review due-time/version contract. See [data model](../data-model/README.md) and [decision 0002](../decisions/0002-shared-vocabulary-catalog.md).
