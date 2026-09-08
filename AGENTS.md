# WordLoop agent guide

## Product boundary

WordLoop is a single Next.js application for one person's English vocabulary practice. The GitHub blog is a separate project and should link to the deployed app; do not reintroduce the app into the blog repository.

## Change rules

- Preserve existing Git history. Never force-push or reset the branch to discard history.
- Keep user data out of fixtures, screenshots, logs, and commits.
- Use Supabase as the source of truth. Do not add localStorage as a second persistence layer.
- Keep service-role keys server-only; the browser may use only the publishable key.
- Add or update docs when an architectural or operational decision changes.
- Use `apply_patch` for hand edits and run the narrowest relevant checks before committing.

## Verification

Run `npm run verify` before a release. For database changes, also run `npm run db:reset` and `npm run verify:db` with Docker/Supabase CLI available. Do not claim connected auth or database behavior passed when only static checks ran.

## Commits and deployment

Use focused imperative commit messages. A normal push is allowed after the user explicitly asks to publish. Vercel and Supabase production setup requires the user's authenticated account and environment variables; never invent or commit those values.
