#!/usr/bin/env node
// Scans recipes/*.md, parses frontmatter, writes recipes/index.json.
// No deps — pure Node.

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const recipesDir = join(root, "recipes");

function parseFrontmatter(text) {
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  if (end === -1) return {};
  const raw = text.slice(3, end).trim();
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else if (/^\d+$/.test(val)) {
      val = Number(val);
    } else {
      val = val.replace(/^["']|["']$/g, "");
    }
    out[key] = val;
  }
  return out;
}

const files = existsSync(recipesDir)
  ? readdirSync(recipesDir).filter(f => f.endsWith(".md"))
  : [];

const entries = files.map(f => {
  const slug = basename(f, ".md");
  const text = readFileSync(join(recipesDir, f), "utf8");
  const fm = parseFrontmatter(text);
  // Only emit an image path if the file actually exists on disk —
  // otherwise the browser logs a 404 for the suggested-but-unfilled slot.
  let image = null;
  if (fm.image) {
    const abs = isAbsolute(fm.image) ? fm.image : join(root, fm.image);
    if (existsSync(abs)) image = fm.image;
  }
  return {
    slug,
    title: fm.title || slug,
    image,
    tags: fm.tags || [],
    time: fm.time || null,
    servings: fm.servings || null,
    source: fm.source || null,
    video: fm.video || null,
    book: fm.book || null,
  };
});

entries.sort((a, b) => a.title.localeCompare(b.title));

writeFileSync(join(recipesDir, "index.json"), JSON.stringify(entries, null, 2) + "\n");
console.log(`Wrote ${entries.length} recipes to recipes/index.json`);
