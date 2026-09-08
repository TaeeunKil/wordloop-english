# Deployment

Import `https://github.com/TaeeunKil/wordloop-english` into Vercel with the repository root as the project root. Add these environment variables for Preview and Production:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

Set `NEXT_PUBLIC_SITE_URL` to the actual deployment origin, configure the same origin in Supabase Auth redirect URLs, and enable both the GitHub and Google providers. GitHub Actions runs static verification; the first authenticated smoke test must be performed against the configured Preview/Production environment.
