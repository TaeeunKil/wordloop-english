# Source rules

- Server Components and server actions own authenticated data access.
- `requireUser()` must guard every private route/action.
- Validate action inputs with Zod before calling Supabase.
- Treat RPC responses as untrusted and map them into the local types.
- Client Components may manage UI state but must not create service-role clients or decide correctness.
- Do not expose raw database errors to the user; log only non-sensitive diagnostic context when logging is introduced.
