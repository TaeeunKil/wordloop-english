import { existsSync, readFileSync } from "node:fs";

const required = ["AGENTS.md", "SECURITY.md", "package.json", "supabase/migrations/202609080001_wordloop_v1.sql", "docs/index.md", ".github/workflows/ci.yml"];
const missing = required.filter(path => !existsSync(path));
if (missing.length) throw new Error(`Missing required repository files: ${missing.join(", ")}`);
const forbidden = /sb_secret_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|BEGIN (RSA |OPENSSH )?PRIVATE KEY/i;
for (const path of ["README.md", "SECURITY.md", ".env.example"]) if (forbidden.test(readFileSync(path, "utf8"))) throw new Error(`Potential secret material in ${path}`);
console.log('Repository checks passed.');
