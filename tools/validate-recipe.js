#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const knownTags = new Set(["mains", "veggie", "meat", "seafood", "fish", "pasta", "rice", "side", "brunch", "sweet", "quick", "slow"]);

function frontmatter(text) {
  if (!text.startsWith("---\n")) return {};
  const end = text.indexOf("\n---", 4);
  if (end < 0) return {};
  const result = {};
  for (const line of text.slice(4, end).split("\n")) {
    const match = line.match(/^([\w-]+):\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith("[") && value.endsWith("]")) value = value.slice(1, -1).split(",").map(item => item.trim()).filter(Boolean);
    result[match[1]] = value;
  }
  return result;
}

function validate(file) {
  const absolute = path.resolve(file);
  const text = fs.readFileSync(absolute, "utf8");
  const fm = frontmatter(text);
  const errors = [];
  for (const key of ["title", "image", "tags", "time", "servings"]) {
    if (!fm[key] || Array.isArray(fm[key]) && !fm[key].length) errors.push(`missing ${key}`);
  }
  if (fm.source) {
    try { new URL(fm.source); } catch (_) { errors.push("source is not a valid URL"); }
  }
  const images = [fm.image, ...(Array.isArray(fm.photos) ? fm.photos : [])].filter(Boolean);
  for (const image of images) {
    const imagePath = path.resolve(root, image);
    if (!imagePath.startsWith(path.resolve(root) + path.sep)) errors.push(`image escapes repository: ${image}`);
    else if (!fs.existsSync(imagePath)) errors.push(`image does not exist: ${image}`);
  }
  if (!Array.isArray(fm.tags)) errors.push("tags must be an array");
  else for (const tag of fm.tags) if (!knownTags.has(tag)) errors.push(`unknown tag: ${tag}`);

  const headings = ["## Ingredients", "## Method", "## My notes"];
  let previous = -1;
  for (const heading of headings) {
    const at = text.indexOf(heading);
    if (at < 0) errors.push(`missing ${heading}`);
    else if (at < previous) errors.push(`${heading} is out of order`);
    previous = Math.max(previous, at);
  }
  const ingredients = text.match(/## Ingredients([\s\S]*?)## Method/);
  if (ingredients && !/^[-*]\s+/m.test(ingredients[1])) errors.push("ingredients must use bullet points");
  const method = text.match(/## Method([\s\S]*?)## My notes/);
  if (method && !/^1\.\s+/m.test(method[1])) errors.push("method must be a numbered list starting at 1");
  if (/\b(same as above|as before|see above)\b/i.test(text)) errors.push("method points back to an earlier section");
  return errors;
}

function main(args) {
  const files = args.length ? args : fs.readdirSync(path.join(root, "recipes")).filter(name => name.endsWith(".md")).map(name => path.join(root, "recipes", name));
  let failures = 0;
  for (const file of files) {
    const errors = validate(file);
    if (errors.length) {
      failures++;
      console.error(`${path.relative(root, file)}:\n  - ${errors.join("\n  - ")}`);
    }
  }
  if (failures) process.exitCode = 1;
  else console.log(`Validated ${files.length} recipe${files.length === 1 ? "" : "s"}.`);
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { frontmatter, validate };
