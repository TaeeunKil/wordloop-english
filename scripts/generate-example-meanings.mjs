import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationSources = [
  ["supabase/migrations/20260908120100_vocabulary_catalog_seed.sql", "wl-v1"],
  ["supabase/migrations/20260908120200_vocabulary_catalog_exp1.sql", "wl-exp1"],
  ["supabase/migrations/20260908120300_vocabulary_catalog_exp2.sql", "wl-exp2"],
  ["supabase/migrations/20260908120400_vocabulary_catalog_exp3.sql", "wl-exp3"],
];
const outputPath = path.join(root, "supabase/migrations/20260909150100_vocabulary_example_meanings.sql");
const cachePath = path.join(root, ".tmp/example-meanings.json");
const batchSize = 5;
const concurrency = 4;

function parseSqlString(value) {
  if (!value.startsWith("'") || !value.endsWith("'")) throw new Error(`Unexpected SQL value: ${value}`);
  return value.slice(1, -1).replaceAll("''", "'");
}

function parseCardLine(line) {
  const start = line.indexOf("(");
  const end = line.lastIndexOf(")");
  if (start < 0 || end <= start) return null;
  const fields = [];
  let field = "";
  let quoted = false;
  for (let i = start + 1; i < end; i += 1) {
    const character = line[i];
    if (character === "'") {
      field += character;
      if (quoted && line[i + 1] === "'") {
        field += line[i + 1];
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field.trim());
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field.trim());
  if (fields.length !== 8 || !/^'L[1-7]'$/.test(fields[0]) || !/^\d+$/.test(fields[1])) return null;
  return {
    contentKey: `${fields[0].slice(1, -1).toLowerCase()}-${fields[1].padStart(3, "0")}`,
    level: fields[0].slice(1, -1),
    sequence: Number(fields[1]),
    term: parseSqlString(fields[2]),
    example: parseSqlString(fields[7]),
  };
}

async function readCards() {
  const cards = [];
  for (const [relativePath, prefix] of migrationSources) {
    const source = await readFile(path.join(root, relativePath), "utf8");
    for (const line of source.split(/\r?\n/)) {
      if (!/^\('L\d+',\d+,/.test(line.trim())) continue;
      const card = parseCardLine(line.trim());
      if (!card) continue;
      cards.push({ ...card, contentKey: `${prefix}-${card.contentKey}` });
    }
  }
  const keys = new Set(cards.map(card => card.contentKey));
  if (cards.length !== 1050 || keys.size !== cards.length) {
    throw new Error(`Expected 1,050 unique cards, found ${cards.length} (${keys.size} unique).`);
  }
  return cards;
}

function decodeHtml(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function cleanTranslation(value) {
  return decodeHtml(value).replace(/\s+/g, " ").trim();
}

async function requestTranslations(cards) {
  const query = cards.map(card => card.example).join("\n");
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", "ko");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", query);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Google Translate returned HTTP ${response.status}`);
  const body = await response.json();
  const translated = Array.isArray(body?.[0])
    ? cards.length === 1
      ? [cleanTranslation(body[0].map(segment => String(segment?.[0] ?? "")).join(""))]
      : body[0].map(segment => cleanTranslation(String(segment?.[0] ?? ""))).filter(Boolean)
    : [];
  if (translated.length !== cards.length) {
    throw new Error(`Expected ${cards.length} translated lines, received ${translated.length}`);
  }
  return translated;
}

async function requestOne(card) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const [translation] = await requestTranslations([card]);
      return translation;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  throw new Error(`Translation failed for ${card.contentKey}`);
}

async function translateCards(cards, existing) {
  const result = { ...existing };
  const missing = cards.filter(card => !result[card.contentKey]);
  let completed = cards.length - missing.length;
  console.log(`Translating ${missing.length} new examples (${completed}/${cards.length} cached).`);
  for (let offset = 0; offset < missing.length; offset += batchSize * concurrency) {
    const batches = [];
    for (let index = offset; index < Math.min(offset + batchSize * concurrency, missing.length); index += batchSize) {
      batches.push(missing.slice(index, index + batchSize));
    }
    const translatedBatches = await Promise.all(batches.map(async batch => {
      try {
        return await requestTranslations(batch);
      } catch {
        return Promise.all(batch.map(requestOne));
      }
    }));
    translatedBatches.forEach((translations, batchIndex) => {
      batches[batchIndex].forEach((card, cardIndex) => { result[card.contentKey] = translations[cardIndex]; });
      completed += batches[batchIndex].length;
    });
    await writeFile(cachePath, JSON.stringify(result, null, 2) + "\n", "utf8");
    console.log(`Translated ${completed}/${cards.length}.`);
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  return result;
}

function sql(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function renderMigration(cards, translations) {
  const values = cards.map(card => `  (${sql(card.contentKey)}, ${sql(translations[card.contentKey])})`).join(",\n");
  return `-- Generated from the original WordLoop catalog examples by scripts/generate-example-meanings.mjs.
-- Google Translate translations are a first-pass Korean draft and remain editorially reviewable.
with meanings(content_key, example_meaning) as (values
${values}
)
update public.vocabulary_catalog c
   set example_meaning = m.example_meaning
  from meanings m
 where c.content_key = m.content_key;

do $$
begin
  if (select count(*) from public.vocabulary_catalog where length(btrim(example_meaning)) = 0) > 0 then
    raise exception 'CATALOG_EXAMPLE_MEANING_INCOMPLETE';
  end if;
end $$;

alter table public.vocabulary_catalog
  add constraint vocabulary_catalog_example_meaning_nonempty
  check (length(btrim(example_meaning)) between 1 and 3000);

comment on column public.vocabulary_catalog.example_meaning is
  'Korean meaning of the full example sentence; initially machine-translated draft, distinct from the word gloss in meaning.';
`;
}

const cards = await readCards();
await mkdir(path.dirname(cachePath), { recursive: true });
let existing = {};
try { existing = JSON.parse(await readFile(cachePath, "utf8")); } catch { /* Start a fresh cache. */ }
const translations = await translateCards(cards, existing);
if (cards.some(card => !translations[card.contentKey])) throw new Error("One or more cards have no translation.");
await writeFile(outputPath, renderMigration(cards, translations), "utf8");
console.log(`Wrote ${outputPath}`);
