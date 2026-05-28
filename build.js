#!/usr/bin/env node
// Scans recipes/*.md, parses frontmatter, writes recipes/index.json.
// No deps — pure Node.

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, basename, isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const recipesDir = join(root, "recipes");

// A commit that *modifies* more than this many recipe files is treated as a
// sweep (e.g. voice/style pass) and doesn't count as a meaningful edit for
// sorting. Creation commits (adds) always count, regardless of size — that's
// how a "seed N recipes at once" commit can still surface those recipes.
const BULK_MODIFY_THRESHOLD = 5;

let gitCommits = null;
let gitDirty = null;

function loadGitState() {
  if (gitCommits !== null) return;
  try {
    const log = execFileSync(
      "git",
      ["log", "--name-status", "--pretty=format:__C__%H %cI", "HEAD"],
      { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
    );
    const commits = [];
    let cur = null;
    for (const line of log.split("\n")) {
      if (line.startsWith("__C__")) {
        if (cur) commits.push(cur);
        const m = line.match(/^__C__(\w+) (.+)$/);
        cur = { date: new Date(m[2]).getTime(), files: new Map(), modifyCount: 0 };
      } else if (line.trim() && cur) {
        // Format: "<status>\t<path>" — status is A/M/D/R##/etc.
        const [status, ...rest] = line.split("\t");
        const path = rest[rest.length - 1];
        if (!path) continue;
        const s = status[0];
        cur.files.set(path, s);
        if (s === "M" && ((path.startsWith("recipes/") && path.endsWith(".md")) || path.startsWith("images/"))) {
          cur.modifyCount++;
        }
      }
    }
    if (cur) commits.push(cur);
    gitCommits = commits;

    const status = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
    const dirty = new Set();
    for (const line of status.split("\n")) {
      const p = line.slice(3).trim();
      if (p) dirty.add(p);
    }
    gitDirty = dirty;
  } catch {
    gitCommits = [];
    gitDirty = new Set();
  }
}

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

function mtime(absPath) {
  try { return statSync(absPath).mtimeMs; } catch { return 0; }
}

// Repo-relative path that matches what `git log --name-only` prints.
function gitPath(absPath) {
  return relative(root, absPath).split(/[\\/]/).join("/");
}

function lastEditTime(absPath) {
  loadGitState();
  const rel = gitPath(absPath);
  // Uncommitted edits should always float — trust the filesystem here.
  if (gitDirty.has(rel)) return mtime(absPath);
  let bulkFallback = 0;
  for (const c of gitCommits) {
    const status = c.files.get(rel);
    if (!status) continue;
    // Creation always counts; modification only if it's not a sweep.
    if (status === "A" || c.modifyCount <= BULK_MODIFY_THRESHOLD) return c.date;
    if (bulkFallback === 0) bulkFallback = c.date;
  }
  // Never seen by git, or only ever in sweeps — fall back to mtime so the
  // file still gets a stable position rather than sinking to the bottom.
  return bulkFallback || mtime(absPath);
}

const entries = files.map(f => {
  const slug = basename(f, ".md");
  const mdAbs = join(recipesDir, f);
  const text = readFileSync(mdAbs, "utf8");
  const fm = parseFrontmatter(text);
  // Only emit an image path if the file actually exists on disk —
  // otherwise the browser logs a 404 for the suggested-but-unfilled slot.
  let image = null;
  let imageEdit = 0;
  if (fm.image) {
    const abs = isAbsolute(fm.image) ? fm.image : join(root, fm.image);
    if (existsSync(abs)) { image = fm.image; imageEdit = lastEditTime(abs); }
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
    updated: Math.max(lastEditTime(mdAbs), imageEdit),
  };
});

// Newest edits first — touching the .md or the image floats a recipe to the top.
entries.sort((a, b) => b.updated - a.updated);

writeFileSync(join(recipesDir, "index.json"), JSON.stringify(entries, null, 2) + "\n");
console.log(`Wrote ${entries.length} recipes to recipes/index.json`);
