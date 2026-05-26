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
