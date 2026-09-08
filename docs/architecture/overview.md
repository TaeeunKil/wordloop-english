# Architecture overview

WordLoop is a root-level Next.js App Router application deployed to Vercel. Private pages and server actions use the Supabase SSR client, with cookies refreshed by `src/proxy.ts`. GitHub OAuth creates the session. PostgreSQL is the only durable store.

The browser sends a proposed review response. The `submit_review` database function authenticates the caller, locks the user's review stream, checks word/state versions, calculates correctness and due time, appends the event, and updates the state in one transaction. RLS protects direct table reads and RPCs are explicitly granted.

The blog repository is intentionally outside this runtime. Its only integration should be a link to the Vercel URL, keeping publishing and study data independent.
