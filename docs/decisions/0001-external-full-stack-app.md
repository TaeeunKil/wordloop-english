# ADR 0001: Keep WordLoop as an external full-stack app

## Status

Accepted

## Context

The existing GitHub blog is a static publishing site. WordLoop needs authentication, durable per-user records, server-side review correctness, and a history that can be queried without generating one Markdown file per response.

## Decision

Deploy WordLoop as its own Next.js application on Vercel with Supabase Auth and PostgreSQL. The blog links to it. GitHub remains the source repository and audit trail, not the runtime database.

## Consequences

This adds Supabase/Vercel setup and environment variables, but preserves a clean blog and gives the app transactions, RLS, login, and future multi-device support. Learning logs can still be exported or summarized into Markdown later.
