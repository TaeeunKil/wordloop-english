import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getConfig } from "@/lib/env";
export async function serverClient() {
  const config = getConfig();
  if (!config) return null;
  const jar = await cookies();
  return createServerClient(config.url, config.key, { cookies: {
    getAll: () => jar.getAll(),
    setAll(values) {
      try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
      catch { /* Server Components cannot mutate cookies; proxy refreshes them. */ }
    },
  } });
}
export async function requireUser() {
  const client = await serverClient();
  if (!client) redirect("/setup");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/?auth=required");
  return { client, user: data.user };
}
