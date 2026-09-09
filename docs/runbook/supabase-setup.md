# Supabase setup

1. Create a Supabase project.
2. In SQL Editor, apply every file in `supabase/migrations/` in filename order, or use the Supabase CLI migration workflow. Never edit an already-applied migration; add a new forward-only migration for a change.
3. Enable GitHub and Google under Authentication → Providers. Create one OAuth app/client for each provider and use the same callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Set the app URL and redirect allow-list to the eventual Vercel URL plus `http://localhost:3000/auth/callback`. For Google OAuth, add the Supabase callback URL as an authorized redirect URI and keep the app account in the Google test-user list while the consent screen is in testing mode.
5. Copy the project URL and publishable key into `.env.local` or Vercel. Never use a service-role key in the browser.

After setup, sign in once with each provider and add a test word. Verify that a second account cannot read or mutate the first account's rows. Do not run a local database reset against the hosted project.
