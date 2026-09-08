export function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!url || !key || !site || !key.startsWith("sb_publishable_")) return null;
  try {
    const endpoint = new URL(url);
    const origin = new URL(site);
    const safe = (u: URL) => u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname));
    if (!safe(endpoint) || !safe(origin) || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password || endpoint.username || endpoint.password) return null;
    return { url: endpoint.origin, key, site: origin.origin };
  } catch { return null; }
}
