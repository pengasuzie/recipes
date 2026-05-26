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

## Voice & Tone (when drafting *as Bruce*)

When writing copy, emails, posts, or any first-person prose for Bruce:
- Plain, direct, lowercase-first sentences are fine.
- **Avoid** "Happy to...", "Jump on a call", "circle back", "touch base", "let's chat", "excited to...", and other performative-availability filler.
- No emoji unless explicitly requested.
- Australian English spelling (organisation, optimise, behaviour, etc.).
- Specific over generic. Concrete over abstract. Short over long.
