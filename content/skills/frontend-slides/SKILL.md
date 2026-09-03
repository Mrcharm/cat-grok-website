---
name: frontend-slides
description: Build stunning, animation-rich HTML presentations/slides and web decks. Two paths — (A) generate from scratch with a fixed 16:9 stage, or (B) pick from a 34-template curated library (template-library/) and adapt it. Also converts PPT/PPTX to web and exports to PDF. Use when the user wants presentation slides, a talk/pitch deck, a web demo, or to convert PowerPoint to HTML. Apply the global visual-quality guardrails (anti-AI-slop) on every artifact.
---

# Frontend Slides

Create zero-dependency, animation-rich HTML presentations that run entirely in the browser. This single skill covers **two complementary paths** plus conversion/export:

- **Path A — Generate from scratch**: design a unique deck with a fixed 1920×1080 stage, following the generation workflow below.
- **Path B — Adapt a curated template**: pick from the `template-library/` (34 hand-authored HTML templates indexed in `template-library/index.json`), clone it, and replace placeholder content with the user's real content.

Both paths share the same visual-quality bar (§0) and the same delivery/export steps (§6–§7).

---

## §0 Global Visual-Quality Guardrails (apply to BOTH paths)

These rules prevent "AI slop." Run the checklist mentally before and after generating any HTML. If a generated artifact hits a ❌ item, fix it.

### 0.1 Composition-first, not component-first
- Start from a visual thesis (one sentence: mood + material + energy), a content plan (hero / support / detail / closing CTA), and an interaction thesis (2–3 motion ideas).
- Each section has ONE job, ONE dominant visual, ONE takeaway.
- Prefer a full-bleed hero / full-canvas visual anchor over a document-like stack.
- Limit the system: ≤2 typefaces, ≤1 accent color by default. No card-grid by default — use section / column / divider / list / media block.

### 0.2 Anti-slop checklist (NON-NEGOTIABLE)
Before finalizing any deck, verify NONE of these appear:
- ❌ Purple-gradient hero / blue-purple mesh background
- ❌ Centered big title over a dark mesh / glow grid
- ❌ Three equal feature cards in a row (the "three-card" cliché)
- ❌ Glassmorphism on everything
- ❌ Infinite-loop micro-animations everywhere
- ❌ Inter + slate-900 default font/color combo
- ❌ Tofu-block layouts / same Google-Fonts pair on every slide
- ❌ Solid-color background with no hierarchy

Replace with: dominant color + sharp accent, a curated typeface pair, orchestrated staggered reveals, hover micro-interactions, scroll-triggered motion, real imagery anchors. **Have a visual intent first, then write components.**

### 0.3 Distinctive aesthetics (from Path A's design ethos)
- **Typography**: choose beautiful, distinctive fonts (Fontshare / Google Fonts). Avoid Arial / Inter / Roboto / system fonts. Vary across generations — don't converge on Space Grotesk every time.
- **Color & theme**: commit to a cohesive aesthetic via CSS variables. Dominant colors with sharp accents beat timid, evenly-distributed palettes.
- **Motion**: CSS-only first; prioritize one well-orchestrated page load with staggered reveals over scattered micro-interactions. Include `prefers-reduced-motion` support.
- **Backgrounds**: atmosphere and depth (gradients, geometric patterns, contextual effects) — not flat solid colors.

### 0.4 Tone-first matching (for Path B)
Templates have **tones, not industries**. Lead with `mood` + `tone` + `best_for` from `index.json`. Treat `avoid_for` as a soft warning (user wins if they explicitly want that look). Use `formality` and `density` to sanity-check. Don't over-fit on `occasion`.

---

## Phase 0: Detect Mode

Determine what the user wants:

- **Mode A: New Presentation (Path A)** — Generate from scratch. Go to §1.
- **Mode B: Template Adaptation (Path B)** — Pick from `template-library/`. Go to §B.
- **Mode C: PPT Conversion** — Convert a .pptx file. Go to §4.
- **Mode D: Enhancement** — Improve an existing HTML presentation. Read it, follow Mode C modification rules (verify 16:9 stage, no overflow, no overlap after any change).

---

## Phase 1 (Path A): Content Discovery

**Ask ALL questions together** (use a structured-question UI if available, else one concise numbered message):

1. **Purpose** (header "Purpose"): Pitch deck / Teaching-Tutorial / Conference talk / Internal presentation
2. **Length** (header "Length"): Short 5–10 / Medium 10–20 / Long 20+
3. **Content** (header "Content"): All content ready / Rough notes / Topic only
4. **Density** (header "Density"): Low density / speaker-led (big ideas, few words) vs High density / reading-first (self-contained detail)

If the user has content, ask them to share it. Remember the density choice — it drives slide count, type scale, and layout.

### Step 1.2: Image Evaluation (if images provided)
Scan → inspect (image-understanding) → evaluate USABLE/NOT → co-design outline around both text and images. Confirm outline before generating.

---

## Phase 2 (Path A): Style Discovery — "Show, Don't Tell"

Generate **3 distinct single-slide HTML previews** (typography + color + motion + aesthetic) based on purpose/audience/mood/density. Do not ask whether they want options — visual comparison is the default.

**Preview mix rules:**
- 1 safe preset from `STYLE_PRESETS.md`, ≥1 bold template from `bold-template-pack/selection-index.json`, 1 wildcard (custom or second bold).
- Read `STYLE_PRESETS.md` and `bold-template-pack/selection-index.json` first; read only shortlisted `preview.md` files, not full `design.md`, until the user picks.
- Keep the three previews genuinely different.

**Preview authenticity (NON-NEGOTIABLE):** every preview must look like a real first slide, never a diagnostic card. Never render internal labels (`preview`, `template`, `Option A/B/C`, file names, slugs) on the slide. Use real deck chrome only (title, date, author, page number).

Save previews to `.frontend-slides/slide-previews/` (style-a.html, style-b.html, style-c.html). Open them for the user, then ask (header "Style"): which preview? / Mix elements.

---

## Phase 3 (Path A): Generate Presentation

Read these supporting files before generating:
- `html-template.md` — HTML architecture & JS features
- `viewport-base.css` — **mandatory**, include its FULL contents in every deck's `<style>`
- `animation-patterns.md` — animation reference
- (if a bold template was chosen) that template's full `design.md` from `bold-template-pack/templates/<slug>/`

**Key requirements:**
- Single self-contained HTML file, all CSS/JS inline.
- Include the FULL `viewport-base.css` in the `<style>` block.
- Fonts from Fontshare or Google Fonts — never system fonts.
- Detailed `/* === SECTION NAME === */` comments per section.
- Apply the user's density choice throughout (see §0.2 / §0.3).

**Fixed 16:9 Stage (NON-NEGOTIABLE):**
- Viewport wrapper fills the window; every slide authored inside a fixed 1920×1080 stage scaled uniformly to fit. Letterbox/pillarbox, never reflow content. No responsive breakpoints rearranging slide content for phones.
- Slide visibility via `.active`/`.visible` using `visibility`/`opacity`/`pointer-events` from `viewport-base.css` — **not** `display:none`/`block` (that breaks the stage).
- Use `clamp()` only for non-slide UI or small fallback previews.
- Never negate CSS functions directly (`-clamp()` is ignored) — use `calc(-1 * clamp(...))`.

---

## §B (Path B): Adapt a Curated Template

Use when the user prefers choosing from existing designs over generating from scratch.

### B.1 Ask occasion + mood
Before reading files, ask:
> "Two quick questions: 1. **What's the occasion?** (founder pitch, research synthesis, brand manifesto, classroom kickoff…) 2. **What mood/vibe?** (confident & punchy, quiet & literary, warm & playful, dark & moody…)"

Wait for the answer. Do not pick yet.

### B.2 Read `template-library/index.json`, pick 3 candidates
Match occasion + mood against each template's `mood`, `tone`, `best_for`, `formality`. Pick three genuinely different templates (e.g. one editorial, one warmer, one wildcard).

### B.3 Build a title-slide preview of each candidate
For each: read `template-library/templates/<slug>/template.html`, take the FIRST slide only, replace placeholder content with the user's real title/subtitle/author/date. Save as `previews/01-<slug>.html` (keep sibling assets like `deck-stage.js` so it opens correctly). Previews must be self-contained and real, not generic.

### B.4 Open all 3 previews, send paths
Use `present_files` to open/preview them (Windows has no `open`). Send paths + one-line tone description each. Wait for the user to pick.

### B.5 Build the full deck in the chosen template
1. Copy the chosen template's full folder into the user's workspace (include `deck-stage.js` / `styles.css` siblings if present).
2. **Always preserve** (the design system): fonts, color palette (`:root` vars), layout grid, slide-level CSS classes, decorative elements, navigation runtime.
3. **Always replace** (user content): headlines, body copy, numbers/stats, names/dates, section-chrome tokens (`[Topic]`, `[Year]`), image placeholders (at same dimensions).
4. More slides than the demo: duplicate an existing layout, replace content, update page numbers. Fewer: drop from bottom.
5. Missing layout? **Design it from the template's own system** (same fonts, palette, decoration, rhythm, grammar) — don't bail, don't switch templates, don't import a new visual language.

### B.6 Open the final deck, send the path
Use `present_files` to open it. Send absolute path + one-line rationale (tone match) + any caveats.

**Path B pitfalls:** don't skip the occasion/mood question; don't skip previews; don't substitute fonts or recolor; don't combine layouts from different templates (extending one is fine); don't strip "extra" decoration; don't "modernize" old templates.

---

## Phase 4: PPT Conversion (Mode C)

1. **Extract content** — `python scripts/extract-pptx.py <input.pptx> <output_dir>` (install python-pptx if needed: `pip install python-pptx`)
2. **Confirm** — present extracted slide titles, content summaries, image counts.
3. **Style selection** — go to Phase 2 (Path A) or §B (Path B).
4. **Generate HTML** — preserve all text, images (from assets/), slide order, speaker notes (as HTML comments).

---

## Phase 5: Delivery

1. Clean up `.frontend-slides/slide-previews/` if it exists.
2. Open the deck (Path A/B: `present_files`; the original repo used `open` — macOS-only, so on Windows use `present_files`).
3. Summarize: file location, style/template name, slide count; navigation (arrow keys / space / swipe); customization (`:root` variables, font link, `.reveal` class); inline editing (hover top-left corner or press E, click text, Ctrl+S). Offer revisions / direct edit / export.

---

## Phase 6: Share & Export (Optional)

Ask: _"Share this presentation? Deploy to a live URL, export to PDF, both, or no thanks?"_

- **Deploy to URL** — `bash scripts/deploy.sh <path>` (Vercel). Guide first-time users through `npx vercel whoami` / `vercel login`.
- **Export to PDF** — `bash scripts/export-pdf.sh <path-to-html> [output.pdf] [--compact]`. Uses Playwright (auto-installs Chromium ~150MB on first run; warn it may take 30–60s). Slides must use `class="slide"`. Note: animations become static snapshots.

---

## Supporting Files

| File | Purpose | When to Read |
| --- | --- | --- |
| `STYLE_PRESETS.md` | 12 curated visual presets | Path A Phase 2 |
| `bold-template-pack/selection-index.json` | Compact bold-template metadata | Path A Phase 2 |
| `bold-template-pack/templates/*/preview.md` | Lightweight style cards | Path A Phase 2 (shortlist) |
| `bold-template-pack/templates/*/design.md` | Full design-system docs (selected only) | Path A Phase 3 |
| `template-library/index.json` | 34-template metadata for Path B | Path B Step B.2 |
| `template-library/templates/<slug>/` | Actual HTML/CSS/design for each template | Path B Steps B.3–B.5 |
| `template-library/runtime/deck-stage.js` | Shared nav runtime some templates need | Path B (copy alongside) |
| `viewport-base.css` | Mandatory fixed-stage CSS | Path A Phase 3 |
| `html-template.md` | HTML structure & JS features | Path A Phase 3 |
| `animation-patterns.md` | CSS/JS animation snippets | Path A Phase 3 |
| `scripts/extract-pptx.py` | PPT content extraction | Phase 4 |
| `scripts/deploy.sh` | Deploy to Vercel | Phase 6 |
| `scripts/export-pdf.sh` | Export to PDF | Phase 6 |

---

## Note: related skills (do NOT merge)
- **`frontend-skill`** — a visual-rule *layer* injected by `prd-to-prototype` for B-end / App HTML prototypes. Its anti-slop checklist is reproduced in §0 above; keep `frontend-skill` intact for that dependency.
- **`ppt-generator`** (disabled) — produces real `.pptx` files via pptxgenjs, a different artifact from HTML decks. Enable it only if the user needs an actual PowerPoint file rather than HTML.
