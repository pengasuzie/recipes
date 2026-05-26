// Tiny markdown renderer — handles headings, paragraphs, lists, bold, italic, links.
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function inline(s) {
  s = escapeHtml(s);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, "$1<em>$2</em>");
  return s;
}
function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      const level = m[1].length + 1; // h2..h5
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
      i++;
    } else if (/^[-*]\s+/.test(line)) {
      out.push("<ul>");
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^[-*]\s+/, ""))}</li>`);
        i++;
      }
      out.push("</ul>");
    } else if (/^\d+\.\s+/.test(line)) {
      out.push("<ol>");
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ""))}</li>`);
        i++;
      }
      out.push("</ol>");
    } else {
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|[-*]\s|\d+\.\s)/.test(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      out.push(`<p>${inline(para.join(" "))}</p>`);
    }
  }
  return out.join("\n");
}

// State
let recipes = [];
let activeTag = "all";
let query = "";

const $ = sel => document.querySelector(sel);
const els = {
  list: $("#list-view"),
  detail: $("#detail-view"),
  grid: $("#recipe-grid"),
  empty: $("#empty-state"),
  search: $("#search"),
  filter: $("#tag-filter"),
  title: $("#app-title"),
  back: $("#back-btn"),
  cook: $("#cook-btn"),
};

async function loadIndex() {
  const res = await fetch("recipes/index.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Failed to load recipe index");
  recipes = await res.json();
}

function uniqueTags() {
  const set = new Set();
  for (const r of recipes) for (const t of (r.tags || [])) set.add(t);
  return Array.from(set).sort();
}

function renderFilter() {
  const tags = ["all", ...uniqueTags()];
  els.filter.innerHTML = tags.map(t => `<button class="tag-chip ${t === activeTag ? "active" : ""}" data-tag="${t}">${t}</button>`).join("");
  els.filter.querySelectorAll(".tag-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      activeTag = btn.dataset.tag;
      renderFilter();
      renderList();
    });
  });
}

function renderList() {
  const q = query.trim().toLowerCase();
  const filtered = recipes.filter(r => {
    if (activeTag !== "all" && !(r.tags || []).includes(activeTag)) return false;
    if (q && !r.title.toLowerCase().includes(q) && !(r.tags || []).some(t => t.includes(q))) return false;
    return true;
  });
  els.grid.innerHTML = filtered.map(r => {
    const img = r.image ? `style="background-image:url('${r.image}')"` : "";
    const imgClass = r.image ? "card-img" : "card-img no-photo";
    const meta = [r.time ? `${r.time} min` : null, r.servings ? `serves ${r.servings}` : null].filter(Boolean).join(" · ");
    return `<a class="card" href="#/recipe/${r.slug}">
      <div class="${imgClass}" ${img}></div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(r.title)}</div>
        <div class="card-meta">${meta}</div>
      </div>
    </a>`;
  }).join("");
  els.empty.hidden = filtered.length > 0;
}

async function renderDetail(slug) {
  const recipe = recipes.find(r => r.slug === slug);
  if (!recipe) { location.hash = ""; return; }
  let notes = "";
  try {
    const res = await fetch(`recipes/${slug}.md`, { cache: "no-cache" });
    if (res.ok) {
      const text = await res.text();
      notes = stripFrontmatter(text);
    }
  } catch (e) {}
  const img = recipe.image
    ? `<div class="hero" style="background-image:url('${recipe.image}')"></div>`
    : `<div class="hero no-photo"></div>`;
  const tagsHtml = (recipe.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");
  const meta = [recipe.time ? `${recipe.time} min` : null, recipe.servings ? `serves ${recipe.servings}` : null].filter(Boolean).join(" · ");
  const sourceBtn = recipe.source
    ? `<a class="open-source" href="${recipe.source}" target="_blank" rel="noopener">Open original ↗</a>`
    : "";
  const credit = recipe.book ? `<p class="book-credit">${escapeHtml(recipe.book)}</p>` : "";
  els.detail.innerHTML = `
    ${img}
    <h1 class="detail-title">${escapeHtml(recipe.title)}</h1>
    <div class="detail-meta">${tagsHtml}${meta ? `<span>${meta}</span>` : ""}</div>
    ${sourceBtn}
    <div class="notes">${notes ? renderMarkdown(notes) : "<p><em>No notes yet. Add your own under <code>recipes/" + slug + ".md</code>.</em></p>"}</div>
    ${credit}
  `;
}

function stripFrontmatter(text) {
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end !== -1) return text.slice(end + 4).replace(/^\s*\n/, "");
  }
  return text;
}

function showList() {
  els.list.hidden = false;
  els.detail.hidden = true;
  els.back.classList.add("invisible");
  els.cook.classList.add("invisible");
  els.title.textContent = "Recipes";
  document.body.classList.remove("cook-mode");
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
}

function showDetail(slug) {
  els.list.hidden = true;
  els.detail.hidden = false;
  els.back.classList.remove("invisible");
  els.cook.classList.remove("invisible");
  const recipe = recipes.find(r => r.slug === slug);
  els.title.textContent = recipe ? recipe.title : "Recipe";
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
}

let wakeLock = null;
async function toggleCookMode() {
  const on = !document.body.classList.toggle("cook-mode") ? false : true;
  if (on) {
    try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); } catch (e) {}
  } else {
    if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; }
  }
}

function route() {
  const hash = location.hash || "";
  const m = hash.match(/^#\/recipe\/(.+)$/);
  if (m) {
    showDetail(m[1]);
    renderDetail(m[1]);
  } else {
    showList();
  }
}

async function init() {
  els.search.addEventListener("input", e => { query = e.target.value; renderList(); });
  els.back.addEventListener("click", () => { history.back(); });
  els.cook.addEventListener("click", toggleCookMode);
  window.addEventListener("hashchange", route);

  try {
    await loadIndex();
    renderFilter();
    renderList();
    route();
  } catch (e) {
    els.grid.innerHTML = `<p style="grid-column:1/-1;color:var(--ink-soft)">Couldn't load recipes. Run <code>node build.js</code> first.</p>`;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
