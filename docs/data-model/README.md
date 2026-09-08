# Data model

| Table | Purpose |
| --- | --- |
| `user_settings` | timezone and daily goal |
| `words` | user's active or archived vocabulary |
| `study_sessions` | open/completed practice sessions |
| `review_events` | append-only response history and receipt |
| `review_state` | current stage, due time, and optimistic version |

All five tables carry an ownership path to `auth.users`. The migration in `supabase/migrations/202609080001_wordloop_v1.sql` enables RLS, adds least-privilege grants, and defines the session/review/statistics functions.
