# Local development

```bash
npm install
copy .env.example .env.local
npm run dev
```

For a local database, install Docker and Supabase CLI, then run `npm run db:start` and `npm run db:reset`. Use `npm run verify:db` for database tests when the CLI is available. `npm run verify` performs repository, environment-shape, lint, typecheck, unit test, and production build checks.
