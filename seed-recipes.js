#!/usr/bin/env node
// One-off seed script: creates a .md stub for each Mezcla recipe.
// Safe to re-run — only writes files that don't already exist (so your edits aren't clobbered).

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const recipesDir = join(root, "recipes");
if (!existsSync(recipesDir)) mkdirSync(recipesDir, { recursive: true });

const recipes = [
  { slug: "chicken-pineapple-nduja-bake", title: "Chicken, Pineapple and 'Nduja Bake", tags: ["mains", "meat", "slow"], time: 60, servings: 4, source: "https://thehappyfoodie.co.uk/recipes/ixta-belfrage-chicken-pineapple-and-nduja-bake/" },
  { slug: "prawn-lasagne-habanero-oil", title: "Prawn Lasagne with Habanero Oil", tags: ["mains", "seafood", "pasta", "slow"], time: 90, servings: 6, source: "https://thehappyfoodie.co.uk/recipes/ixta-belfrages-prawn-and-requeijao-lasagne-with-dende-chilli-oil/" },
  { slug: "chiles-rellenos-salsa-roja-risotto", title: "Chiles Rellenos with Salsa Roja Risotto", tags: ["mains", "veggie", "rice", "slow"], time: 90, servings: 4, source: "https://thehappyfoodie.co.uk/recipes/ixta-belfrage-chiles-rellenos-with-salsa-roja-risotto/" },
  { slug: "tomato-salad-tahini-ginger-crumpet-croutons", title: "Tomato Salad with Tahini Ginger Sauce & Crumpet Croutons", tags: ["veggie", "side", "quick"], time: 25, servings: 4, source: "https://www.nigella.com/recipes/guests/tomato-tahini-and-ginger-salad-with-crumpet-croutons" },
  { slug: "piri-piri-tofu-crispy-orzo", title: "Piri Piri Tofu with Crispy Orzo", tags: ["mains", "veggie", "pasta", "quick"], time: 30, servings: 4, source: "https://thehappyfoodie.co.uk/articles/cook-from-the-book-mezcla/" },
  { slug: "giant-cheese-on-toast-honey-urfa-butter", title: "Giant Cheese on Toast with Honey & Urfa Butter", tags: ["veggie", "brunch", "quick"], time: 25, servings: 4, source: "https://thehappyfoodie.co.uk/articles/10-dishes-youll-discover-in-ixta-belfrages-mezcla/" },
  { slug: "passion-fruit-pudim", title: "Passion Fruit Pudim", tags: ["sweet", "slow"], time: 90, servings: 8, source: "https://thehappyfoodie.co.uk/recipes/ixta-belfrages-passionfruit-and-coconut-pudim/" },
  { slug: "scallops-curried-onions-lime", title: "Scallops with Curried Onions & Lime", tags: ["mains", "seafood", "quick"], time: 30, servings: 4, source: "https://thehappyfoodie.co.uk/articles/10-dishes-youll-discover-in-ixta-belfrages-mezcla/" },
  { slug: "whole-baked-sea-bass-tangerine", title: "Whole Baked Sea Bass with Tangerine", tags: ["mains", "fish", "slow"], time: 60, servings: 4, source: "https://thehappyfoodie.co.uk/recipes/ixta-belfrage-brown-butter-sea-bass-with-tangerine-dipping-sauce/" },
  { slug: "mussels-orzo-coconut-saffron-stew", title: "Mussels & Orzo in Coconut & Saffron Stew", tags: ["mains", "seafood", "pasta", "quick"], time: 30, servings: 4, source: "https://www.stylist.co.uk/food-drink/mezcla-ixta-belfrage-recipes-inventive-flavour-combinations/679321" },
  { slug: "sticky-coconut-rice-cake-turmeric-tomatoes", title: "Sticky Coconut Rice Cake with Turmeric Tomatoes", tags: ["mains", "veggie", "rice", "slow"], time: 90, servings: 4, source: "https://www.wolfandbadger.com/ca/magazine/inspiration/inspiration/an-ixta-belfrage-recipe-sticky-coconut-rice-cake-with-turmeric-tomatoes/" },
  { slug: "roasted-cabbage-mango-harissa", title: "Roasted Cabbage with Mango & Harissa", tags: ["veggie", "side", "quick"], time: 30, servings: 4, source: "https://www.greatbritishchefs.com/recipes/roasted-cabbage-mango-harissa-sauce-recipe" },
  { slug: "porcini-ragu", title: "Porcini Ragù", tags: ["mains", "veggie", "pasta", "quick"], time: 30, servings: 4, source: "https://thehappyfoodie.co.uk/articles/cook-from-the-book-mezcla/" },
  { slug: "short-ribs-mole-sauce", title: "Short Ribs with Mole-inspired Sauce", tags: ["mains", "meat", "slow"], time: 300, servings: 4, source: "https://thehappyfoodie.co.uk/articles/10-dishes-youll-discover-in-ixta-belfrages-mezcla/" },
  { slug: "spinach-herb-dumplings-cherry-tomato", title: "Spinach & Herb Dumplings with Cherry Tomato Sauce", tags: ["mains", "veggie", "slow"], time: 75, servings: 4, source: "https://thehappyfoodie.co.uk/articles/10-dishes-youll-discover-in-ixta-belfrages-mezcla/" },
  { slug: "cassava-fries-chilli-butter", title: "Cassava Fries with Chilli Butter", tags: ["veggie", "side"], time: 45, servings: 4, source: "https://thehappyfoodie.co.uk/articles/10-dishes-youll-discover-in-ixta-belfrages-mezcla/" },
  { slug: "oyster-mushroom-noodles-caraway-onions", title: "Oyster Mushroom Noodles with Caramelised Caraway Onions", tags: ["mains", "veggie", "quick"], time: 30, servings: 4, source: "https://thehappyfoodie.co.uk/articles/cook-from-the-book-mezcla/" },
  { slug: "confit-squid-aubergine-pasta", title: "Confit Squid & Aubergine Pasta", tags: ["mains", "seafood", "pasta", "slow"], time: 90, servings: 4, source: "https://thehappyfoodie.co.uk/articles/10-dishes-youll-discover-in-ixta-belfrages-mezcla/" },
  { slug: "torta-ahogada", title: "Torta Ahogada (Drowned Sandwiches)", tags: ["mains", "meat", "slow"], time: 75, servings: 4, source: "https://thehappyfoodie.co.uk/articles/10-dishes-youll-discover-in-ixta-belfrages-mezcla/" },
  { slug: "cannelloni-enchiladas-salsa-roja", title: "Cannelloni Enchiladas with Salsa Roja", tags: ["mains", "veggie", "pasta", "slow"], time: 90, servings: 6, source: "https://thehappyfoodie.co.uk/articles/10-dishes-youll-discover-in-ixta-belfrages-mezcla/" },
];

const BOOK = "Mezcla by Ixta Belfrage (Ebury Press, 2022)";

let written = 0, skipped = 0;
for (const r of recipes) {
  const path = join(recipesDir, `${r.slug}.md`);
  if (existsSync(path)) { skipped++; continue; }
  const tags = `[${r.tags.join(", ")}]`;
  const body = `---
title: ${r.title}
image: images/${r.slug}.jpg
tags: ${tags}
time: ${r.time}
servings: ${r.servings}
source: ${r.source}
book: ${BOOK}
---

## My notes

Add your own tweaks, swaps, and timings here. Dictate from your phone if it's faster.
`;
  writeFileSync(path, body);
  written++;
}

console.log(`Seeded ${written} recipes, skipped ${skipped} existing.`);
