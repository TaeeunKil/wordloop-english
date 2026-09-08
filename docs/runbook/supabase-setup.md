# Supabase setup

1. Create a Supabase project.
2. In SQL Editor, apply `supabase/migrations/202609080001_wordloop_v1.sql`, or use the Supabase CLI migration workflow.
3. Enable GitHub under Authentication → Providers. Create a GitHub OAuth app with callback URL `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Set the app URL and redirect allow-list to the eventual Vercel URL plus `http://localhost:3000/auth/callback`.
5. Copy the project URL and publishable key into `.env.local` or Vercel. Never use a service-role key in the browser.

After setup, sign in once and add a test word. Verify that a second account cannot read or mutate the first account's rows.
