const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { extractWebsiteData, imageDimensions, renderDraft, sourceType } = require("./extract-recipe");
const { run } = require("./recipe-requests");
const { frontmatter } = require("./validate-recipe");

async function test() {
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="Ignored article title">
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Tomato Toast",
      author: [{ "@type": "Person", name: "Test Cook" }],
      description: "Chef&apos;s quick toast.",
      recipeYield: "2 servings",
      recipeIngredient: ["2 tomatoes", "4 slices bread"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Toast the bread." }, { "@type": "HowToStep", text: "Add tomatoes." }],
      image: ["https://example.com/toast.jpg"],
    })}</script></head><body>
    <section><h2>Ingredients</h2><p><b>Sauce</b></p><ul>
      <li><b>2 tomatoes</b> with <a href="/red-paste"><span>red paste</span></a></li>
      <li>4 slices bread</li>
    </ul></section>
    <section data-variant="instructions"><p><b>Curing time:</b> 3 hours</p></section>
    <section><h2>Instructions</h2><ol>
      <li>Toast the bread.</li><li>Add tomatoes.</li>
    </ol></section>
    <a href="https://www.sbs.com.au/ondemand/tv-series/test/season-1/test-s1-ep1/123">Watch</a>
    </body></html>`;
  const parsed = extractWebsiteData(html, "https://example.com/toast");
  assert.equal(parsed.title, "Tomato Toast");
  assert.equal(parsed.author, "Test Cook");
  assert.equal(parsed.description, "Chef's quick toast.");
  assert.deepEqual(parsed.ingredients, ["2 tomatoes with red paste", "4 slices bread"]);
  assert.deepEqual(parsed.ingredient_groups, [{ name: "Sauce", items: ["2 tomatoes with red paste", "4 slices bread"] }]);
  assert.deepEqual(parsed.instructions, ["Toast the bread.", "Add tomatoes."]);
  assert.deepEqual(parsed.notes, ["Curing time: 3 hours"]);
  assert.equal(parsed.video, "https://www.sbs.com.au/ondemand/tv-series/test/season-1/test-s1-ep1/123");
  assert.equal(parsed.image_candidates[0].url, "https://example.com/toast.jpg");
  const draft = renderDraft(parsed);
  assert.equal(draft.slug, "tomato-toast");
  assert(draft.markdown.includes("Chef's quick toast."));
  assert(draft.markdown.includes("### Sauce"));
  assert(draft.markdown.includes("- 2 tomatoes with red paste"));
  assert(draft.markdown.includes("1. Toast the bread."));
  assert(draft.markdown.includes("- Curing time: 3 hours"));
  assert.equal(sourceType("https://www.instagram.com/reel/test"), "instagram");
  assert.equal(sourceType("https://youtu.be/test"), "youtube");
  assert.equal(sourceType("https://example.com/recipe"), "website");

  const pngHeader = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(pngHeader);
  pngHeader.writeUInt32BE(1280, 16);
  pngHeader.writeUInt32BE(720, 20);
  const pngPath = path.join(os.tmpdir(), `recipe-image-${process.pid}.png`);
  fs.writeFileSync(pngPath, pngHeader);
  assert.deepEqual(imageDimensions(pngPath), { width: 1280, height: 720 });
  fs.rmSync(pngPath);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "recipe-queue-test-"));
  const calls = [];
  const api = async (route, options = {}) => {
    calls.push([route, options]);
    if (route.endsWith("claim_recipe_request")) return [{ id: "request-id", state: "working", claim_token: "token", url: "https://example.com/toast", note: "less salt" }];
    return null;
  };
  await run(["claim", "request-id", work], api);
  assert.equal(JSON.parse(fs.readFileSync(path.join(work, "request.json"))).claim_token, "token");
  await run(["ready", path.join(work, "request.json"), "tomato-toast", "done"], api);
  assert.deepEqual(JSON.parse(calls.at(-1)[1].body), {
    request_id: "request-id", token: "token", result_slug: "tomato-toast", new_note: "done",
  });
  await run(["failed", path.join(work, "request.json"), "Source unavailable"], api);
  assert.equal(JSON.parse(calls.at(-1)[1].body).result_slug, null);

  const fm = frontmatter("---\ntitle: Test\ntags: [mains, veggie]\n---\n");
  assert.equal(fm.title, "Test");
  assert.deepEqual(fm.tags, ["mains", "veggie"]);
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261103000100_recipe_requests.sql"), "utf8");
  assert(migration.includes("recipe_routine_fire_url"));
  assert(migration.includes("experimental-cc-routine-2026-04-01"));
  assert(!migration.includes("api.openai.com"));
  fs.rmSync(work, { recursive: true, force: true });
  console.log("PASS: website extraction, source routing, recipe queue and frontmatter validation");
}

test().catch(error => { console.error(error); process.exitCode = 1; });
