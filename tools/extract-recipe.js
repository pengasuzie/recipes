#!/usr/bin/env node
// Capture a recipe URL into an ignored work package. This script does not write the final recipe.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function command(program, args, options = {}) {
  const result = spawnSync(program, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${program} failed: ${(result.stderr || result.stdout || "unknown error").trim()}`);
  }
  return result;
}

function decodeHtml(value = "") {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:0?39|x27);/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value = "") {
  if (Array.isArray(value)) value = value.map(item => item && typeof item === "object" ? item.name || item.text || "" : item).join(", ");
  else if (value && typeof value === "object") value = value.name || value.text || "";
  value = String(value || "");
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/li>|<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, "is"));
  return match ? decodeHtml(match[2]) : "";
}

function meta(html, key) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if (attr(tag, "property") === key || attr(tag, "name") === key) return attr(tag, "content");
  }
  return "";
}

function flattenJsonLd(value, found = []) {
  if (!value || typeof value !== "object") return found;
  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  if (types.includes("Recipe")) found.push(value);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach(item => flattenJsonLd(item, found));
    else if (child && typeof child === "object") flattenJsonLd(child, found);
  }
  return found;
}

function recipeJsonLd(html) {
  const recipes = [];
  const scripts = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    try { flattenJsonLd(JSON.parse(decodeHtml(match[1].trim())), recipes); } catch (_) {}
  }
  return recipes[0] || null;
}

function instructionText(value) {
  if (!value) return [];
  if (typeof value === "string") return [stripHtml(value)];
  if (Array.isArray(value)) return value.flatMap(instructionText);
  if (value.itemListElement) return instructionText(value.itemListElement);
  if (value.text) return [stripHtml(value.text)];
  return [];
}

function imageUrls(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(imageUrls);
  return imageUrls(value.url || value.contentUrl);
}

function wprmList(html, containerClass) {
  const start = html.search(new RegExp(`class=["'][^"']*${containerClass}`, "i"));
  if (start < 0) return [];
  const next = html.slice(start + 1).search(/class=["'][^"']*wprm-recipe-(?:ingredients|instructions|notes)-container/i);
  const block = html.slice(start, next < 0 ? start + 100000 : start + 1 + next);
  return [...block.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map(match => stripHtml(match[1]).replace(/\s+/g, " "))
    .filter(Boolean);
}

function extractImageCandidates(html, recipe, pageTitle) {
  const candidates = [];
  const add = (url, alt = "", score = 0) => {
    if (!/^https?:\/\//i.test(url || "")) return;
    candidates.push({ url, alt: stripHtml(alt), score });
  };
  imageUrls(recipe && recipe.image).forEach(url => add(url, pageTitle, 100));
  add(meta(html, "og:image"), meta(html, "og:image:alt") || pageTitle, 90);

  const marker = html.search(/<(?:div|section|article)\b[^>]*(?:wprm-recipe-container|tasty-recipes|mv-create)|<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]{0,50000}?recipeIngredient/i);
  const endMarker = marker < 0 ? html.length : Math.min(html.length, marker + 100000);
  const content = marker < 0 ? html : html.slice(Math.max(0, marker - 150000), endMarker);
  for (const match of content.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const className = attr(tag, "class");
    const alt = attr(tag, "alt");
    const width = Number(attr(tag, "width") || 0);
    const height = Number(attr(tag, "height") || 0);
    const label = `${className} ${alt} ${attr(tag, "title")} ${attr(tag, "src")}`.toLowerCase();
    if (/logo|icon|avatar|author|star|light-?bulb|lighbulb|bike|emoji|advert|pp-post-img|related/.test(label)) continue;
    if (width && height && (width < 500 || height < 350)) continue;
    let url = attr(tag, "src");
    const srcset = attr(tag, "srcset");
    if (srcset) {
      const choices = srcset.split(",").map(part => {
        const bits = part.trim().split(/\s+/);
        return { url: bits[0], width: parseInt(bits[1], 10) || 0 };
      }).sort((a, b) => b.width - a.width);
      if (choices[0]) url = choices[0].url;
    }
    add(url, alt, 40 + Math.min(30, Math.floor((width * height) / 500000)));
  }

  const seen = new Set();
  return candidates
    .sort((a, b) => b.score - a.score)
    .filter(item => {
      const key = item.url.replace(/-\d+x\d+(?=\.[a-z]+(?:\?|$))/i, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function extractWebsiteData(html, url) {
  const recipe = recipeJsonLd(html);
  const wprmName = html.match(/class=["'][^"']*wprm-recipe-name[^"']*["'][^>]*>([\s\S]*?)<\//i);
  const title = stripHtml((recipe && recipe.name) || (wprmName && wprmName[1]) || meta(html, "og:title") || "");
  const ingredients = recipe ? (recipe.recipeIngredient || []).map(stripHtml).filter(Boolean) : wprmList(html, "wprm-recipe-ingredients-container");
  const instructions = recipe ? instructionText(recipe.recipeInstructions).filter(Boolean) : wprmList(html, "wprm-recipe-instructions-container");
  const servingsMatch = html.match(/class=["'][^"']*wprm-recipe-servings(?:\s|["'])[^>]*>([^<]+)/i);
  return {
    source_type: "website",
    source: url,
    title,
    author: stripHtml((recipe && recipe.author && (recipe.author.name || recipe.author)) || meta(html, "author") || ""),
    description: stripHtml((recipe && recipe.description) || meta(html, "og:description") || ""),
    servings: stripHtml((recipe && recipe.recipeYield) || (servingsMatch && servingsMatch[1]) || ""),
    prep_time: recipe && recipe.prepTime || "",
    cook_time: recipe && recipe.cookTime || "",
    total_time: recipe && recipe.totalTime || "",
    ingredients,
    instructions,
    video: imageUrls(recipe && recipe.video && (recipe.video.contentUrl || recipe.video.embedUrl))[0] || "",
    image_candidates: extractImageCandidates(html, recipe, title),
  };
}

function safeExtension(url) {
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    return /^\.(?:jpe?g|png|webp|gif|avif)$/.test(ext) ? (ext === ".jpeg" ? ".jpg" : ext) : ".jpg";
  } catch (_) { return ".jpg"; }
}

function downloadCandidate(candidate, outputDir, index) {
  const filename = `candidate-${String(index + 1).padStart(2, "0")}${safeExtension(candidate.url)}`;
  const destination = path.join(outputDir, filename);
  const result = command("curl", ["-L", "--fail", "--silent", "--show-error", candidate.url, "-o", destination], { allowFailure: true });
  if (result.status !== 0) return { ...candidate, error: (result.stderr || "download failed").trim() };
  return { ...candidate, file: filename };
}

function findFiles(directory, pattern) {
  return fs.readdirSync(directory).filter(name => pattern.test(name)).sort();
}

function ytDlpArgs(args) {
  const browser = process.env.YT_DLP_COOKIES_BROWSER;
  return browser ? ["--cookies-from-browser", browser, ...args] : args;
}

function socialMetadata(url) {
  const result = command("yt-dlp", ytDlpArgs(["--dump-single-json", "--skip-download", "--no-warnings", url]));
  return JSON.parse(result.stdout);
}

function socialCandidates(metadata) {
  const entries = Array.isArray(metadata.entries) && metadata.entries.length ? metadata.entries : [metadata];
  return entries.flatMap(entry => {
    const thumbnails = entry && entry.thumbnails || [];
    const best = thumbnails.filter(item => item.url).sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    const url = entry && (entry.thumbnail || best && best.url);
    return url ? [{ url, alt: entry.title || metadata.title || "", score: 100 }] : [];
  }).slice(0, 20);
}

function captureFrames(url, outputDir, warnings) {
  const output = path.join(outputDir, "source.%(ext)s");
  const download = command("yt-dlp", ytDlpArgs([
    "--no-warnings", "--merge-output-format", "mp4",
    "-f", "bv*[height<=720]+ba/b[height<=720]/b",
    "-o", output, url,
  ]), { allowFailure: true });
  if (download.status !== 0) {
    const detail = (download.stderr || download.stdout || "").trim().split("\n").at(-1);
    warnings.push(`Video download failed; no process frames were captured${detail ? ` (${detail})` : ""}. Set YT_DLP_COOKIES_BROWSER when the source requires a logged-in browser.`);
    return [];
  }
  const video = findFiles(outputDir, /^source\.(?:mp4|mkv|webm|mov)$/i)[0];
  if (!video) return [];
  const videoPath = path.join(outputDir, video);
  const probe = command("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", videoPath], { allowFailure: true });
  const duration = Number(probe.stdout);
  if (!duration) return [];
  const files = [];
  [0.2, 0.4, 0.6, 0.8, 0.94].forEach((fraction, index) => {
    const filename = `frame-${String(index + 1).padStart(2, "0")}.jpg`;
    const frame = command("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(duration * fraction), "-i", videoPath, "-frames:v", "1", "-q:v", "2", path.join(outputDir, filename)], { allowFailure: true });
    if (frame.status === 0) files.push(filename);
  });
  return files;
}

function extractSocial(url, outputDir, type, noVideo) {
  let metadata;
  try { metadata = socialMetadata(url); }
  catch (error) {
    if (type !== "instagram") throw error;
    const page = path.join(outputDir, "instagram-fallback.html");
    command("curl", ["-L", "--fail", "--silent", "--show-error", "-A", "facebookexternalhit/1.1", url, "-o", page]);
    const html = fs.readFileSync(page, "utf8");
    const rawTitle = stripHtml(meta(html, "og:title"));
    const titleMatch = rawTitle.match(/^(.+?) on Instagram:\s*["“]([\s\S]*)["”]$/i);
    const recoveredDescription = stripHtml(meta(html, "og:description")) || titleMatch && titleMatch[2] || "";
    const fallback = {
      source_type: type,
      source: url,
      title: (recoveredDescription.split("\n").find(Boolean) || rawTitle).trim(),
      author: titleMatch && titleMatch[1] || "",
      description: recoveredDescription,
      ingredients: [],
      instructions: [],
      servings: "",
      video: url,
      image_candidates: [],
      frame_candidates: [],
      caption_files: [],
      warnings: ["Instagram blocked anonymous yt-dlp access. The public caption and cover were recovered, but the worker should retry with browser cookies when a carousel or spoken recipe may contain more detail."],
    };
    const cover = meta(html, "og:image");
    if (cover) fallback.image_candidates.push(downloadCandidate({ url: cover, alt: fallback.title, score: 100 }, outputDir, 0));
    fs.writeFileSync(path.join(outputDir, "description.txt"), fallback.description);
    return fallback;
  }
  fs.writeFileSync(path.join(outputDir, "metadata.json"), JSON.stringify(metadata, null, 2) + "\n");
  const description = metadata.description || metadata.fulltitle || "";
  fs.writeFileSync(path.join(outputDir, "description.txt"), description);
  const warnings = [];
  const candidates = socialCandidates(metadata).map((candidate, index) => downloadCandidate(candidate, outputDir, index));

  const subtitles = command("yt-dlp", ytDlpArgs([
    "--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", "en.*,en",
    "--convert-subs", "vtt", "-o", path.join(outputDir, "captions.%(ext)s"), url,
  ]), { allowFailure: true });
  if (subtitles.status !== 0) warnings.push("No English captions were available.");

  const frames = noVideo ? [] : captureFrames(url, outputDir, warnings);
  return {
    source_type: type,
    source: url,
    title: metadata.title || "",
    author: metadata.uploader || metadata.channel || "",
    description,
    ingredients: [],
    instructions: [],
    servings: "",
    video: url,
    image_candidates: candidates,
    frame_candidates: frames,
    caption_files: findFiles(outputDir, /\.vtt$/i),
    warnings,
  };
}

function sourceType(url) {
  const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "youtube";
  return "website";
}

function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "new-recipe";
}

function durationMinutes(value) {
  const match = String(value || "").match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  return match ? Number(match[1] || 0) * 1440 + Number(match[2] || 0) * 60 + Number(match[3] || 0) || "" : "";
}

function renderDraft(data) {
  const title = String(data.title || "New recipe").split("\n")[0].trim();
  const slug = slugify(title);
  const servingsMatch = String(data.servings || "").match(/\d+/);
  const minutes = durationMinutes(data.total_time) || durationMinutes(data.prep_time) + durationMinutes(data.cook_time) || "";
  const lines = [
    "---",
    `title: ${title.replace(/:/g, " –")}`,
    `image: images/${slug}.jpg`,
    "tags: []",
    `time: ${minutes}`,
    `servings: ${servingsMatch ? servingsMatch[0] : ""}`,
    `source: ${data.source}`,
  ];
  if (data.video) lines.push(`video: ${data.video}`);
  lines.push("---", "", "## Ingredients", "");
  lines.push(...(data.ingredients || []).map(item => `- ${String(item).replace(/\s+/g, " ").trim()}`));
  lines.push("", "## Method", "");
  lines.push(...(data.instructions || []).map((item, index) => `${index + 1}. ${String(item).replace(/\s+/g, " ").trim()}`));
  lines.push("", "## My notes", "");
  return { slug, markdown: lines.join("\n") + "\n" };
}

function extract(url, outputDir, options = {}) {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("Only http and https URLs are supported");
  fs.mkdirSync(outputDir, { recursive: true });
  const type = sourceType(url);
  let data;
  if (type === "website") {
    const page = path.join(outputDir, "source.html");
    command("curl", ["-L", "--fail", "--silent", "--show-error", url, "-o", page]);
    const html = fs.readFileSync(page, "utf8");
    data = extractWebsiteData(html, url);
    data.image_candidates = data.image_candidates.map((candidate, index) => downloadCandidate(candidate, outputDir, index));
  } else {
    data = extractSocial(url, outputDir, type, options.noVideo);
  }
  fs.writeFileSync(path.join(outputDir, "source.json"), JSON.stringify(data, null, 2) + "\n");
  const draft = renderDraft(data);
  fs.writeFileSync(path.join(outputDir, "draft.md"), draft.markdown);
  data.draft_slug = draft.slug;
  return data;
}

if (require.main === module) {
  const [url, outputDir, ...flags] = process.argv.slice(2);
  if (!url || !outputDir) {
    console.error("Usage: node tools/extract-recipe.js <url> <requests-work/directory> [--no-video]");
    process.exit(1);
  }
  try {
    const data = extract(url, outputDir, { noVideo: flags.includes("--no-video") });
    console.log(JSON.stringify({ type: data.source_type, title: data.title, files: outputDir, images: data.image_candidates.length, frames: (data.frame_candidates || []).length }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { extract, extractWebsiteData, recipeJsonLd, renderDraft, sourceType, stripHtml };
