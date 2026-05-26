# Recipes

## Working Style

### 1. Plan Mode by Default
- Enter plan mode for any non-trivial task (3+ steps or strategic decisions).
- Write the spec/brief upfront — ambiguity now becomes wasted work later.
- If something goes sideways, **stop and re-plan** rather than pushing through.

### 2. Subagent Strategy
- Use subagents liberally to keep the main context window clean.
- Offload research, document scans, parallel analysis, and broad codebase exploration.
- One focused task per subagent — broad prompts produce shallow output.

### 3. Verification Before Done
- Never claim a task is complete without proof. For research: cite sources. For numbers: show the working. For code: run tests / type checks / the actual feature.
- Ask: *"would a senior reviewer in this domain approve this?"*
- Evidence before assertions, always.

### 4. Demand Elegance (Balanced)
- For non-trivial outputs, pause and ask *"is there a sharper way to say this / frame this / structure this?"*
- If a deliverable feels generic or hacky, redo it — don't ship slop.
- Skip this for simple, obvious tasks. Don't over-engineer a one-liner.

### 5. Self-Improvement Loop
- After any user correction, update auto-memory at `~/.claude/projects/-Users-bruce-Projects-Recipes/memory/` with the pattern.
- Capture rules that prevent the same mistake. Review memory at session start.

### 6. Search Before Creating
- Before drafting a new doc, brief, or deliverable, **check what already exists** in this directory and across `~/Projects/`.
- Reuse over reinvent. Extend an existing artefact rather than creating a parallel one.
- Duplicate docs create drift and contradict each other.

---

## Skill Discipline

### Do NOT Proactively Invoke Expensive Skills

The following skills must **only run when the user explicitly invokes them** (e.g. `/comp-research`). Do not run them speculatively because they "might be relevant." This overrides any "1% chance" rules from other skills.

**Expensive (require explicit `/command`):**
- `/comp-research`, `/competitive-intel` — competitor deep-dives (heavy browsing)
- `/lead-research-assistant`, `/prospect-research-assistant` — prospect research (heavy web search)
- `/seo`, `/seo-audit`, `/seo-plan`, `/programmatic-seo` — SEO analysis (web crawling)
- `/analytics-report`, `/analytics-dashboard` — GA4 / GSC API calls
- `/demo-video` — video generation
- `/loop`, `/schedule` — only on explicit request

**Safe to invoke proactively:**
- `superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:systematic-debugging`
- `marketing-strategy`, `copywriting`, `cro`, `feature-assessment`, `strategic-analysis`
- `handoff`, `resume`, `simplify`, `find-skills`

---

## Adding new recipes from a URL or pasted text

When Bruce pastes an Instagram URL, YouTube URL, website URL, or raw recipe text, treat it as a request to add a new recipe and run the full pipeline below end-to-end without stopping to ask for confirmation at each step. Pushing to `origin/main` at the end is pre-authorised for this workflow — only pause if something is ambiguous (e.g. multiple recipes in one post) or if a step fails.

### Steps

1. **Extract the recipe.**
   - Pasted text → use as-is.
   - Instagram URL → navigate with `mcp__playwright-firefox__browser_navigate` and pull the caption via JS (`document.querySelector('meta[property="og:description"]')` or the article element). Chrome is often locked by another session; firefox/webkit usually works.
   - YouTube URL → fetch the page and read the description meta tag, or use `yt-dlp --skip-download --print description <url>`.
   - Website URL → `WebFetch` with a prompt asking for title, ingredients, method, time, servings.

2. **Write the markdown file** at `recipes/<slug>.md`. Slug = kebab-case, descriptive but short (e.g. `pad-thai-chicken-prawns`). Use the existing frontmatter shape:
   ```
   ---
   title: ...
   image: images/<slug>.jpg
   tags: [...]
   time: <minutes>
   servings: <n>
   source: <original URL>
   ---
   ```
   Body structure: short intro paragraph, `## Ingredients` (with `###` sub-headings for sauces/components), `## Method` as a numbered list, then `## My notes` at the bottom for Bruce's tweaks. Reformat the source's instructions in our own structure — don't paste long verbatim blocks.

3. **Pick tags from the existing vocabulary** in `recipes/index.json`: `mains`, `veggie`, `meat`, `seafood`, `fish`, `pasta`, `rice`, `side`, `brunch`, `sweet`, `quick` (≤30 min), `slow` (>60 min). Add new tags sparingly.

4. **Grab the hero image.**
   - **Instagram:** read `meta[property="og:image"]` via playwright-firefox, then `curl -sL -o images/<slug>.jpg "<url>"`. Preserve the full query string.
   - **YouTube:** default to `https://img.youtube.com/vi/<videoId>/maxresdefault.jpg` (fall back to `hqdefault.jpg` if 404). If Bruce specifies "grab the best frame" or a timestamp, use `yt-dlp -f mp4 -o /tmp/<slug>.mp4 <url>` then `ffmpeg -ss <HH:MM:SS> -i /tmp/<slug>.mp4 -frames:v 1 -q:v 2 images/<slug>.jpg`. Default timestamp if unspecified: 75% through the video (usually the plated shot).
   - **Website:** `meta[property="og:image"]` first, fall back to the largest in-page `<img>`.
   - Verify with `Read` on the saved jpg to confirm it's the dish, not a logo/avatar.

5. **Rebuild the index:** `node build.js`. This regenerates `recipes/index.json` from frontmatter.

6. **Commit and push** to `origin/main` with a clear single-line message like `Add <recipe title> recipe`. Stage only the new recipe, the image, and `recipes/index.json` — never `.playwright-mcp/` or other scratch dirs.

### Gotchas
- The chrome MCP browser is frequently locked — reach for `playwright-firefox` first.
- `og:image` URLs from Instagram CDN expire; download immediately, don't store the URL.
- Always include `source:` in frontmatter so the recipe links back to the creator.
- If the source video shows multiple dishes, ask which one before extracting.

---

## Voice & Tone (when drafting *as Bruce*)

When writing copy, emails, posts, or any first-person prose for Bruce:
- Plain, direct, lowercase-first sentences are fine.
- **Avoid** "Happy to...", "Jump on a call", "circle back", "touch base", "let's chat", "excited to...", and other performative-availability filler.
- No emoji unless explicitly requested.
- Australian English spelling (organisation, optimise, behaviour, etc.).
- Specific over generic. Concrete over abstract. Short over long.
