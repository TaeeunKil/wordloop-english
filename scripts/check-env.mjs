const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SITE_URL"];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  console.log(`Environment not configured (expected for static CI): ${missing.join(", ")}`);
  process.exit(0);
}
const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const site = new URL(process.env.NEXT_PUBLIC_SITE_URL);
if (!['http:', 'https:'].includes(url.protocol) || !['http:', 'https:'].includes(site.protocol)) throw new Error('Supabase and site URLs must be http(s).');
if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')) throw new Error('Use a Supabase publishable key, not a secret key.');
console.log('Environment shape looks valid.');
