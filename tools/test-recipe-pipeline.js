const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { extractWebsiteData, renderDraft, sourceType } = require("./extract-recipe");
const { run } = require("./recipe-requests");
const { frontmatter } = require("./validate-recipe");

async function test() {
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="Ignored article title">
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Tomato Toast",
      author: { "@type": "Person", name: "Test Cook" },
      recipeYield: "2 servings",
      recipeIngredient: ["2 tomatoes", "4 slices bread"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Toast the bread." }, { "@type": "HowToStep", text: "Add tomatoes." }],
      image: ["https://example.com/toast.jpg"],
    })}</script></head><body></body></html>`;
  const parsed = extractWebsiteData(html, "https://example.com/toast");
  assert.equal(parsed.title, "Tomato Toast");
  assert.deepEqual(parsed.ingredients, ["2 tomatoes", "4 slices bread"]);
  assert.deepEqual(parsed.instructions, ["Toast the bread.", "Add tomatoes."]);
  assert.equal(parsed.image_candidates[0].url, "https://example.com/toast.jpg");
  const draft = renderDraft(parsed);
  assert.equal(draft.slug, "tomato-toast");
  assert(draft.markdown.includes("- 2 tomatoes"));
  assert(draft.markdown.includes("1. Toast the bread."));
  assert.equal(sourceType("https://www.instagram.com/reel/test"), "instagram");
  assert.equal(sourceType("https://youtu.be/test"), "youtube");
  assert.equal(sourceType("https://example.com/recipe"), "website");

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
  fs.rmSync(work, { recursive: true, force: true });
  console.log("PASS: website extraction, source routing, recipe queue and frontmatter validation");
}

test().catch(error => { console.error(error); process.exitCode = 1; });
