# Recipes

Personal recipe book. Static PWA — installs to iPhone home screen like an app, no App Store.

## How it works

- Each recipe is a markdown file in `recipes/` with frontmatter (title, photo, tags, time, servings, source URL, book reference).
- `node build.js` scans `recipes/` and writes `recipes/index.json`, which the app loads for fast search/filter.
- Vanilla JS frontend. Service worker caches everything for offline use.
- Hosted free on GitHub Pages.

## Add a new recipe

1. Drop a photo in `images/` (e.g. `images/my-recipe.jpg`)
2. Create `recipes/my-recipe.md`:

   ```markdown
   ---
   title: My Recipe
   image: images/my-recipe.jpg
   tags: [mains, quick]
   time: 30
   servings: 4
   source: https://example.com/the-recipe
   book: Some Cookbook by Some Author, p.42
   ---

   ## My notes
   - Doubled the garlic. Worth it.
   - Skip the cilantro if cooking for J.
   ```

3. Commit and push. GitHub Actions rebuilds the index and redeploys.

## Add from a URL

Tap **+** in the app, sign in with the same Supabase account used by Thongs, then paste a website, Instagram or YouTube URL. The request shows one of four states: Waiting, Being worked on, Ready or Couldn't be done. A ready request links directly to the new recipe.

The queue is defined in `supabase/migrations/20261103000100_recipe_requests.sql`. The worker commands are:

```bash
node tools/recipe-requests.js list
node tools/recipe-requests.js claim <uuid> requests-work/<uuid>
node tools/extract-recipe.js <url> requests-work/<uuid> # writes source.json, media candidates and draft.md
node tools/validate-recipe.js recipes/<slug>.md
node tools/recipe-requests.js ready requests-work/<uuid>/request.json <slug>
```

`SUPABASE_SECRET_KEY` is required by the queue worker and must stay outside the repository. When Instagram or YouTube requires a login, set `YT_DLP_COOKIES_BROWSER` to the browser name understood by `yt-dlp` (for example `safari` or `chrome`). Never commit exported cookies.

The worker is a Claude Code routine, using the same architecture as Thongs and Bruce's Claude plan rather than API billing. Store its trigger URL and bearer token in Supabase Vault as `recipe_routine_fire_url` and `recipe_routine_fire_token`. A new request fires the routine immediately; its regular schedule remains the fallback. Without those Vault values, submitted requests remain safely queued.

Filename = URL slug. Lowercase, dash-separated.

## First-time setup

```bash
# 1. Generate icons (one-time)
python3 make-icons.py

# 2. Build the recipe index
node build.js

# 3. Test locally
python3 -m http.server 8000
# open http://localhost:8000
```

Run the import checks with:

```bash
node tools/test-recipe-pipeline.js
```

### Deploy to GitHub Pages

```bash
git init -b main
git add .
git commit -m "Initial recipes app"

# Create a private repo on github.com (e.g. "recipes")
git remote add origin git@github.com:YOUR-USERNAME/recipes.git
git push -u origin main
```

Then on github.com:
1. Repo → **Settings** → **Pages** → **Source**: "GitHub Actions"
2. Wait ~1 min for the deploy workflow to finish
3. URL will be `https://YOUR-USERNAME.github.io/recipes/`

### Install on iPhone

1. Open the URL in **Safari** (not Chrome — Chrome on iOS doesn't support PWA install properly)
2. Tap **Share** → **Add to Home Screen**
3. Done. Tap the icon — fullscreen, offline-capable.

## Cook mode

Tap the cook-mode icon (top right) on any recipe → bigger text, darker background, screen stays awake. Tap again to exit.

## Tips

- **Tags** are free-form. Use any words you like (`thai`, `weeknight`, `freezer-friendly`). They'll appear as filter chips automatically.
- **Source URL** is optional but useful. Tap "Open original" on any recipe to jump to where you saved it from.
- **No photo yet?** Leave `image:` blank — the card shows a placeholder.
- **Offline**: once you've visited a recipe with signal, it's cached. Cook anywhere.

## Privacy

The site is technically public (GitHub Pages doesn't password-protect), but the URL is unguessable unless someone knows your username. If you want it locked down, host on Netlify with password protection instead.
