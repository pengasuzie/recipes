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
const FAVOURITES_KEY = "recipes:favourites";
let favourites = new Set();
try { favourites = new Set(JSON.parse(localStorage.getItem(FAVOURITES_KEY) || "[]")); } catch (_) {}

const heartIcon = solid => `<svg viewBox="0 0 24 24" fill="${solid ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg>`;
const isFavourite = slug => favourites.has(slug);

function favouriteButton(slug, title, detail = false) {
  const on = isFavourite(slug);
  const label = `${on ? "Remove" : "Add"} ${title} ${on ? "from" : "to"} favourites`;
  return `<button class="favourite-btn${detail ? " detail-favourite" : ""}" type="button" data-favourite="${escapeHtml(slug)}" aria-pressed="${on}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${heartIcon(on)}</button>`;
}

function toggleFavourite(slug) {
  isFavourite(slug) ? favourites.delete(slug) : favourites.add(slug);
  localStorage.setItem(FAVOURITES_KEY, JSON.stringify([...favourites]));
  renderFilter();
  renderList();
  refreshDetailFavourite(slug);
}

function refreshDetailFavourite(slug) {
  const button = els.detail.querySelector(`[data-favourite="${CSS.escape(slug)}"]`);
  const recipe = recipes.find(r => r.slug === slug);
  if (!button || !recipe) return;
  const on = isFavourite(slug);
  const label = `${on ? "Remove" : "Add"} ${recipe.title} ${on ? "from" : "to"} favourites`;
  button.innerHTML = heartIcon(on);
  button.setAttribute("aria-pressed", String(on));
  button.setAttribute("aria-label", label);
  button.title = label;
}

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
  add: $("#add-btn"),
  addPanel: $("#add-panel"),
};

let detailHeaderCleanup = null;

function setHeaderTitle(text, compact = false) {
  if (text === "Recipes") {
    const link = document.createElement("a");
    link.className = "app-home-link";
    link.href = "#/";
    link.textContent = text;
    els.title.replaceChildren(link);
  } else {
    els.title.textContent = text;
  }
  els.title.classList.toggle("compact", compact);
}

function clearDetailHeader() {
  if (detailHeaderCleanup) detailHeaderCleanup();
  detailHeaderCleanup = null;
}

function watchDetailTitle(recipeTitle) {
  clearDetailHeader();
  const heading = els.detail.querySelector(".detail-title");
  if (!heading) return;

  let frame = null;
  const update = () => {
    frame = null;
    const headerBottom = $("#app-header").getBoundingClientRect().bottom;
    const titleHasPassed = heading.getBoundingClientRect().bottom <= headerBottom + 8;
    setHeaderTitle(titleHasPassed ? recipeTitle : "Recipes", titleHasPassed);
  };
  const scheduleUpdate = () => {
    if (frame === null) frame = requestAnimationFrame(update);
  };

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  update();
  detailHeaderCleanup = () => {
    window.removeEventListener("scroll", scheduleUpdate);
    window.removeEventListener("resize", scheduleUpdate);
    if (frame !== null) cancelAnimationFrame(frame);
  };
}

const SB = { url: "https://fmqsttxwgstzhjwfnxnk.supabase.co", key: "sb_publishable_SR0gJiUU3BbRHPUUrG0E8w_HCSRRyzh" };
const REQUEST_SESSION = "recipes:session";
const requestState = { busy: false, email: "", refreshing: null };

function savedSession() {
  try { return JSON.parse(localStorage.getItem(REQUEST_SESSION) || "null"); } catch (_) { return null; }
}

function saveSession(data) {
  const session = {
    access: data.access_token,
    refresh: data.refresh_token,
    exp: data.expires_at || Date.now() / 1000 + data.expires_in,
    email: data.user && data.user.email,
  };
  localStorage.setItem(REQUEST_SESSION, JSON.stringify(session));
  return session;
}

async function authenticate(body, grant) {
  const response = await fetch(`${SB.url}/auth/v1/token?grant_type=${grant}`, {
    method: "POST",
    headers: { apikey: SB.key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error_description || data.message || `error ${response.status}`), { status: response.status });
  return saveSession(data);
}

async function accessToken() {
  let session = savedSession();
  if (!session) throw new Error("signed out");
  if (Date.now() / 1000 > session.exp - 60) {
    if (!requestState.refreshing) requestState.refreshing = authenticate({ refresh_token: session.refresh }, "refresh_token").finally(() => { requestState.refreshing = null; });
    try { session = await requestState.refreshing; }
    catch (error) { if (error.status >= 400 && error.status < 500) localStorage.removeItem(REQUEST_SESSION); throw error; }
  }
  return session.access;
}

async function requestRest(route, options = {}) {
  const response = await fetch(`${SB.url}/rest/v1/${route}`, {
    ...options,
    headers: {
      apikey: SB.key,
      Authorization: "Bearer " + await accessToken(),
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const text = await response.text();
  if (!response.ok) throw Object.assign(new Error(`error ${response.status}`), { status: response.status, body: text });
  return text ? JSON.parse(text) : null;
}

function requestError(message = "") {
  const element = $("#request-error");
  element.textContent = message;
  element.hidden = !message;
}

function requestLabel(url) {
  try {
    const parsed = new URL(url);
    const label = parsed.hostname.replace(/^www\./, "") + parsed.pathname.replace(/\/$/, "");
    return label.length > 62 ? label.slice(0, 59) + "…" : label;
  } catch (_) { return url; }
}

function drawRequestAccount() {
  const session = savedSession();
  $("#sign-in-form").hidden = !!session;
  $("#request-area").hidden = !session;
  $("#request-email").textContent = session && session.email || "";
  if (!session) $("#request-history").replaceChildren();
  return session;
}

async function refreshRequests() {
  const session = drawRequestAccount();
  if (!session || requestState.busy) return;
  requestState.busy = true;
  try {
    const requests = await requestRest("recipe_requests?select=id,url,state,slug,result_note,created_at&order=created_at.desc&limit=50");
    const states = { waiting: "Waiting", working: "Being worked on", ready: "Ready", failed: "Couldn't be done" };
    $("#request-history").innerHTML = requests.map(request => {
      const label = escapeHtml(requestLabel(request.url));
      const title = request.state === "ready"
        ? `<a href="#/recipe/${encodeURIComponent(request.slug)}">${label} · Ready</a>`
        : `<b>${label}</b><p>${states[request.state] || escapeHtml(request.state)}</p>`;
      return `<div class="request-row">${title}${request.result_note ? `<p>${escapeHtml(request.result_note)}</p>` : ""}</div>`;
    }).join("") || '<p class="request-row">No requests yet.</p>';
    requestError("");
  } catch (error) {
    drawRequestAccount();
    requestError(error.status === 404 ? "Recipe requests are not enabled yet." : "Couldn't load requests. Try again.");
  } finally { requestState.busy = false; }
}

function initRequests() {
  els.add.addEventListener("click", () => {
    els.addPanel.hidden = !els.addPanel.hidden;
    els.add.setAttribute("aria-expanded", String(!els.addPanel.hidden));
    drawRequestAccount();
    if (!els.addPanel.hidden) refreshRequests();
  });
  $("#sign-in-form").addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.target.querySelector("button");
    button.disabled = true;
    requestError("Signing in…");
    try {
      await authenticate({ email: $("#sign-in-email").value.trim(), password: $("#sign-in-password").value }, "password");
      event.target.reset();
      drawRequestAccount();
      await refreshRequests();
    } catch (error) {
      requestError(error.status === 400 ? "That email and password don't match." : "Couldn't sign in. Try again.");
    } finally { button.disabled = false; }
  });
  $("#recipe-request-form").addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.target.querySelector("button");
    button.disabled = true;
    try {
      await requestRest("recipe_requests", {
        method: "POST",
        body: JSON.stringify({ url: $("#request-url").value.trim(), note: $("#request-note").value.trim() || null }),
      });
      event.target.reset();
      await refreshRequests();
    } catch (error) {
      requestError(/duplicate/i.test(error.body || "") ? "That URL is already waiting." : "Couldn't add the recipe. Try again.");
    } finally { button.disabled = false; }
  });
  $("#sign-out-btn").addEventListener("click", async () => {
    const session = savedSession();
    localStorage.removeItem(REQUEST_SESSION);
    drawRequestAccount();
    requestError("");
    if (session) fetch(`${SB.url}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: SB.key, Authorization: "Bearer " + session.access } }).catch(() => {});
  });
  drawRequestAccount();
  setInterval(() => { if (!document.hidden && savedSession()) refreshRequests(); }, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && savedSession()) refreshRequests(); });
}

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
  const tags = ["all", "favourites", ...uniqueTags()];
  els.filter.innerHTML = tags.map(t => {
    const label = t === "favourites"
      ? `${heartIcon(activeTag === t)}<span>Favourites${favourites.size ? ` · ${favourites.size}` : ""}</span>`
      : t;
    return `<button class="tag-chip ${t === "favourites" ? "favourites-chip " : ""}${t === activeTag ? "active" : ""}" data-tag="${t}" aria-pressed="${t === activeTag}">${label}</button>`;
  }).join("");
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
    if (activeTag === "favourites" && !isFavourite(r.slug)) return false;
    if (activeTag !== "all" && activeTag !== "favourites" && !(r.tags || []).includes(activeTag)) return false;
    if (q && !r.title.toLowerCase().includes(q) && !(r.tags || []).some(t => t.includes(q))) return false;
    return true;
  });
  els.grid.innerHTML = filtered.map(r => {
    const img = r.image ? `style="background-image:url('${r.image}')"` : "";
    const imgClass = r.image ? "card-img" : "card-img no-photo";
    const meta = [r.time ? `${r.time} min` : null, r.servings ? `serves ${r.servings}` : null].filter(Boolean).join(" · ");
    return `<div class="card-wrap">
      <a class="card" href="#/recipe/${r.slug}">
        <div class="${imgClass}" ${img}></div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(r.title)}</div>
          <div class="card-meta">${meta}</div>
        </div>
      </a>
      ${favouriteButton(r.slug, r.title)}
    </div>`;
  }).join("");
  els.empty.hidden = filtered.length > 0;
  els.empty.textContent = activeTag === "favourites"
    ? "No favourites yet. Tap a heart to add one."
    : "No recipes match.";
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
  const videoBtn = recipe.video
    ? `<a class="open-source" href="${recipe.video}" target="_blank" rel="noopener">▶ Watch the video</a>`
    : "";
  const sourceBtn = recipe.source && recipe.source !== recipe.video
    ? `<a class="open-source" href="${recipe.source}" target="_blank" rel="noopener">Open original ↗</a>`
    : "";
  const actionButtons = videoBtn || sourceBtn
    ? `<div class="recipe-actions">${videoBtn}${sourceBtn}</div>`
    : "";
  const gallery = (recipe.photos || []).length
    ? `<div class="recipe-gallery">${recipe.photos.map((photo, i) =>
        `<img src="${escapeHtml(photo)}" alt="${escapeHtml(recipe.title)} — photo ${i + 2}" loading="lazy">`
      ).join("")}</div>`
    : "";
  const credit = recipe.book ? `<p class="book-credit">${escapeHtml(recipe.book)}</p>` : "";
  els.detail.innerHTML = `
    ${img}
    <div class="detail-heading">
      <h1 class="detail-title">${escapeHtml(recipe.title)}</h1>
      ${favouriteButton(recipe.slug, recipe.title, true)}
    </div>
    <div class="detail-meta">${tagsHtml}${meta ? `<span>${meta}</span>` : ""}</div>
    ${actionButtons}
    <div class="notes">${notes ? renderMarkdown(notes) : "<p><em>No notes yet. Add your own under <code>recipes/" + slug + ".md</code>.</em></p>"}</div>
    ${gallery}
    ${credit}
  `;
  if (!els.detail.hidden && location.hash === `#/recipe/${slug}`) watchDetailTitle(recipe.title);
}

function stripFrontmatter(text) {
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end !== -1) return text.slice(end + 4).replace(/^\s*\n/, "");
  }
  return text;
}

function showList() {
  clearDetailHeader();
  els.list.hidden = false;
  els.detail.hidden = true;
  els.back.classList.add("invisible");
  els.cook.classList.add("invisible");
  els.add.classList.remove("invisible");
  setHeaderTitle("Recipes");
  document.body.classList.remove("cook-mode");
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
}

function showDetail(slug) {
  clearDetailHeader();
  els.list.hidden = true;
  els.detail.hidden = false;
  els.back.classList.remove("invisible");
  els.cook.classList.remove("invisible");
  els.add.classList.add("invisible");
  els.addPanel.hidden = true;
  els.add.setAttribute("aria-expanded", "false");
  setHeaderTitle("Recipes");
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
  initRequests();
  els.search.addEventListener("input", e => { query = e.target.value; renderList(); });
  els.grid.addEventListener("click", event => {
    const button = event.target.closest("[data-favourite]");
    if (button) toggleFavourite(button.dataset.favourite);
  });
  els.detail.addEventListener("click", event => {
    const button = event.target.closest("[data-favourite]");
    if (button) toggleFavourite(button.dataset.favourite);
  });
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
