# Deployment

## Vercel

Import `https://github.com/TaeeunKil/wordloop-english` into Vercel with the repository root as the project root. Add these environment variables separately to Preview and Production:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

Set `NEXT_PUBLIC_SITE_URL` to the actual deployment origin, configure the same origin in Supabase Auth redirect URLs, and enable both the GitHub and Google providers. Run the repository verification before release; the first authenticated smoke test must be performed against the configured Preview/Production environment.

The Vercel project, domain, team membership, deployment history, and environment-variable values live in Vercel. They are intentionally not stored in this repository. See [secure handoff](secure-handoff.md) before working from a new clone.

## Verification

Run `npm run verify` before a release. It checks repository shape, environment-variable format, lint, types, tests, and the production build. It does not prove that hosted Supabase RLS, OAuth providers, or Vercel variables are configured correctly.

After deployment, sign in with Google and GitHub, create one test word, complete one review, and confirm that a second account cannot read or modify the first account's rows. Remove only intentional test data through the app or Supabase dashboard; never export it into the repository.
