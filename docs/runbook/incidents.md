# Incident checklist

1. Check Vercel deployment logs without copying tokens or user data into issues.
2. Check Supabase Auth and database status.
3. If records look inconsistent, stop repeated submissions and inspect `review_events` before changing `review_state`.
4. Rotate any credential that may have been exposed, then update Vercel variables and redeploy.
5. Record the date, impact, cause, and recovery in a private note; keep this public repository free of personal data.
