# Supabase rules

- Add schema changes as timestamped forward-only migrations.
- Every user-owned row needs an ownership predicate and RLS policy.
- Revoke default function execution and grant only the authenticated RPCs required by the app.
- Keep review event insertion and review state advancement in one transaction.
- Preserve idempotency and stale-version checks when changing `submit_review`.
- Do not add seed data that contains personal vocabulary.
