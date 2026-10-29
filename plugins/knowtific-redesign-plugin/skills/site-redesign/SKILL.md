---
name: site-redesign
description: Run a full redesign engagement for an existing business website - understand the business step by step, audit every page (UI, UX, clarity, conversion, landing pages, SEO, performance, accessibility, brand, positioning, marketing), write an internal agency report and a simpler sellable client report, build an improvement plan, then create 3 brand directions and 3 variations of the 3 key pages with a live comparison viewer. Use when the user asks to redesign, revamp, audit or pitch a redesign for a client's website, or runs /knowtific-redesign-plugin:redesign.
---

# Site redesign

You are running a redesign engagement for a web agency (Knowtific, Melbourne; clients are mostly
Australian small and medium businesses: tradies, allied health, local services). The output has two
audiences: **the agency** (what is wrong, what we can sell, how much work) and **the client** (simple,
visual, convincing). Everything you claim must be backed by evidence from the site or the owner.

## Ground rules

1. **Evidence or it didn't happen.** Every finding names the page, what you saw (a screenshot path,
   a metric, a quote of on-page text under 15 words) and why it matters for the business. No generic
   advice ("improve UX"); say what, where, and what to do instead.
2. **Business before pixels.** You do not judge design until you understand who the customer is, what
   the money services are, and what action the site must drive. Discovery comes first, always.
3. **Never invent business facts.** Prices, years in business, licences, review counts, guarantees
   and claims come from the site or the owner. If missing, mark `[TO CONFIRM]` and add it to the
   open-questions list. Variation copy may use clearly marked placeholders, never fake reviews.
4. **Gates.** Stop for the user's approval at the end of Discovery, Audit, Plan and Brand. Show a
   short summary and the file paths; ask what to change. Do not run the whole pipeline silently.
5. **Resume, don't restart.** Read `redesign/state.json` first. Continue from the first phase not
   marked `done`. Update it after every phase.
6. **Use subagents for fan-out.** Page audits and page variations run in parallel through this
   plugin's agents (see each phase). Give each agent the file paths it needs, not pasted content.
7. **Australia by default.** Use Australian English, AUD, local SEO (Google Business Profile, suburbs,
   service areas) and check compliance notes in `references/compliance-au.md` for health clients,
   testimonials, pricing claims and privacy.

## Workspace

All work goes in `redesign/` in the current project (create it). Paths below are relative to it.

```
redesign/
  state.json                      phase status, site URL, chosen pages, decisions
  01-discovery/
    site-snapshot.md              what the site says about the business (from crawl)
    questions.md                  interview log: question, answer, source
    business-profile.md           the agreed understanding of the business
    competitors.md                3-5 competitors, what they do better/worse
  02-audit/
    crawl/                        pages.json, site.json, brand-current.json, shots/, text/, axe/
    tech/                         lighthouse/PSI summaries
    page-notes/<slug>.md          one per page, from the page-auditor agent
    findings.json                 every finding, schema in references/audit-checklists.md
    scorecard.json                0-10 score per dimension with one-line reason
  03-reports/
    internal-report.md            for the agency
    client-report.html (+ .pdf)   for the client
  04-plan/
    plan.md                       roadmap, sitemap, page plans, KPIs, the 3 key pages
  05-brand/
    brands.json                   3 brand directions (schema in references/brand-directions.md)
    logos/<id>-*.svg
  06-variations/<page>/{a,b,c}.html  (+ _shots/ screenshots)
  _rd/                            generated brand runtime, brands.js, logos, client photos (build-preview)
  preview/                        built by scripts/build-preview.mjs - deployable static site
  preview-report.json             warnings from the last preview build
  decision.json                   exported from the viewer: chosen layout + brand + notes
```

Scripts live in `${CLAUDE_PLUGIN_ROOT}/scripts`. If that variable is not expanded in your shell,
the plugin root is two folders above this skill's base directory (`<base>/../..`); resolve it once
and use the absolute path, and pass that absolute path to every agent you launch.
First run in a session (Node 18.17+ required):

```bash
npm --prefix "${CLAUDE_PLUGIN_ROOT}/scripts" install --no-audit --no-fund
npx --prefix "${CLAUDE_PLUGIN_ROOT}/scripts" playwright install chromium
```

## Phase 1 - Discovery (understand the business)

Read `references/discovery.md` and follow it. In short:

1. **Crawl first** so you can read the site before asking anything:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/crawl.mjs" <url> --out redesign/02-audit/crawl --max 40`
   (add `--include "/services/*"` patterns or `--urls file.txt` if the site is large).
2. Read `pages.json`, the page text in `crawl/text/` and the home + main service screenshots.
   Write `site-snapshot.md`: what they sell, to whom, where, how they ask for the enquiry, proof
   shown, and what is unclear. Note every gap.
3. Research competitors (web search: "<service> <suburb/city>", Google Maps pack, the names the
   owner gives). Write `competitors.md`.
4. **Interview the user in rounds** with AskUserQuestion (max 4 questions per round, pre-filled
   options from what you already learned, always allow free text). Order: money services and job
   value -> ideal customer and service area -> why customers choose them / competitors -> proof and
   assets -> sales process and follow-up -> current marketing and tracking -> goals and constraints
   (budget, CMS, who edits, deadline). Skip anything the site already answers. Log every answer
   in `questions.md`. If the user doesn't know an answer, record it as a question for the client.
5. Write `business-profile.md` using the template in `references/discovery.md`, including the
   one-sentence positioning statement and the site's **primary conversion goal** per audience.
6. **Gate:** summarise in 8-10 lines, list open questions for the client, ask for corrections.

## Phase 2 - Audit (find every problem)

Read `references/audit-checklists.md` (dimensions, checks, severity rubric, findings schema).

1. Technical data: `node "${CLAUDE_PLUGIN_ROOT}/scripts/tech-audit.mjs" --pages redesign/02-audit/crawl/pages.json --out redesign/02-audit/tech --top 8`
   (uses Lighthouse locally; add `--psi` to also pull PageSpeed Insights field data when online).
2. **Page audits in parallel:** for each crawled page that matters (home, every money service page,
   contact/quote, about, key location pages, top blog posts - usually 6-15 pages), launch the
   `page-auditor` agent with: the page URL, its entry in `pages.json`, screenshot paths, text path,
   axe file, and `01-discovery/business-profile.md`. Batch up to 5 at a time. Each writes
   `page-notes/<slug>.md` and returns findings as JSON lines.
3. In parallel, launch `technical-auditor` (SEO, performance, a11y, tracking, security across the
   site) and `brand-strategist` (logo, brand consistency, positioning, messaging vs competitors,
   marketing/funnel gaps).
4. Merge everything into `findings.json` (dedupe: the same issue on 9 pages is one finding with 9
   pages listed). Assign IDs `F-001...`, priority from the rubric, and the agency service that fixes
   it. Write `scorecard.json`.
5. **Gate:** show the scorecard, the top 10 findings by priority and counts per dimension.

## Phase 3 - Reports (two audiences)

Read `references/report-templates.md`.

- `internal-report.md`: full findings table, root causes, what Knowtific can sell (website, local SEO,
  Google Ads, CRM, AI automations, branding, content), effort estimates, risks, upsell sequence and
  the questions to ask in the meeting.
- `client-report.html`: plain English, visual, short. Scorecard, "what's costing you enquiries" (top
  5 with screenshots), quick wins, what the new site will do, before/after promise, 3 package options,
  next step. Build from `${CLAUDE_PLUGIN_ROOT}/templates/client-report.html`, then render a PDF with
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/to-pdf.mjs" redesign/03-reports/client-report.html`.
- Launch `report-reviewer` on the client report before showing it (fresh eyes: accurate, simple,
  not insulting to the owner, every claim traceable to a finding).

## Phase 4 - Plan

Read `references/plan-template.md`. Write `plan.md`: goals and KPIs, new sitemap, page-by-page plan
(purpose, audience, sections in order, primary CTA, content needed), landing pages for ads, SEO plan,
tracking plan, content/asset list, phased roadmap (quick wins -> rebuild -> grow). Pick the **3 key
pages** to redesign (default: Home, the main money service page, and the conversion page - quote/
contact or a dedicated ad landing page) and justify the choice. Save them in `state.json`.
**Gate:** confirm the 3 pages and the plan.

## Phase 5 - Brand directions (3 options)

Read `references/brand-directions.md`. Create 3 deliberately different directions, each a full
mini-system: concept and positioning angle, voice, palette (8 tokens, contrast-checked), type pair
(Google Fonts), radius/shape language, imagery direction, and an original SVG logo set (primary,
mark, on-dark). Typical spread: **A Evolve** (keep equity, fix problems), **B Refresh** (modern,
clearer), **C Bold** (new positioning-led identity). Write `brands.json` and the SVGs. Run
`node "${CLAUDE_PLUGIN_ROOT}/scripts/build-preview.mjs" redesign` to validate contrast and render the
brand board. **Gate:** show the board, ask for adjustments.

## Phase 6 - Page variations (3 pages x 3 layouts)

Read `references/page-variations.md`. For each key page create 3 layouts that differ in **strategy**,
not just styling (e.g. A proof-led, B offer/urgency-led, C guided/education-led). All variations use
brand tokens (CSS variables + `data-brand-logo`) so the viewer can show any layout with any brand.
Launch one `variation-builder` agent per page (3 agents, each writes a, b, c for its page) with the
plan, business profile, brands.json path and the page's findings. Real copy written for this
business; no lorem ipsum.

## Phase 7 - Live preview and decision

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-preview.mjs" redesign` - copies variations, brand
   runtime, current-site screenshots and the viewer into `redesign/preview/`, checks every page
   for broken token use, missing alt text and contrast, and prints warnings. Fix warnings.
2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/serve.mjs" redesign/preview --port 4321` (run in background)
   and give the user `http://localhost:4321`.
3. To share with the client: deploy `redesign/preview/` to any static host
   (`npx vercel deploy redesign/preview --prod`, `npx netlify deploy --dir redesign/preview`,
   or Cloudflare Pages). Ask before deploying - it publishes client material.
4. The viewer lets reviewers mix layout x brand, compare side by side on desktop/tablet/mobile,
   score, and leave notes, then export `decision.json`. When the user drops it in `redesign/`,
   read it and write a short decision brief in `04-plan/decision-brief.md` (what was chosen, why,
   changes requested, next build steps).

## Tooling notes

- `crawl.mjs` also writes `brand-current.json` (colours, fonts, logo - feeds the "Current" brand
  option), `images/images.json` (the client's real photos for variations), axe results per page,
  broken links and duplicate titles/descriptions/H1s in `site.json`. Large sites: use `--include`,
  `--exclude` or `--urls`; slow sites: `--timeout 60000 --concurrency 2`.
- Set `CHROME_PATH` to use an existing Chrome/Chromium instead of Playwright's download.
- `shoot.mjs <file|url> --out dir [--brand id] [--widths 390,834,1440]` screenshots anything and
  flags overflow, missing mobile CTA and console errors.
- The preview vendors Tailwind's browser build into `_rd/tailwind.js`, so it works offline and on
  any static host. Google Fonts load from Google when online, with fallbacks otherwise.

## State file

```json
{
  "site": "https://example.com.au",
  "client": "Example Plumbing",
  "phases": {"discovery": "done", "audit": "in_progress", "reports": "todo", "plan": "todo",
             "brand": "todo", "variations": "todo", "preview": "todo"},
  "keyPages": [{"slug": "home", "label": "Home"}, {"slug": "hot-water", "label": "Hot water"},
               {"slug": "quote", "label": "Get a quote"}],
  "updated": "2026-10-29"
}
```

## Running a single phase

Users may call a phase directly (`/knowtific-redesign-plugin:audit`, `:brand`, `:variations`...). Check the
inputs that phase needs exist; if a prerequisite is missing, say which and offer to run it first
(the crawl is the only hard prerequisite for everything).

## Related

If the `marketing-coach` skill is available, use its frameworks for positioning, funnel and landing-
page advice so the agency speaks one language. `frontend-design` is useful while building variations.
