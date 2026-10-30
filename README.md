# Knowtific redesign plugin

Claude Code marketplace (`knowtific-redesign`) for Knowtific client website redesigns.

| Plugin | What it does |
|---|---|
| `knowtific-redesign-plugin` | Full redesign engagement for an existing client website: business discovery, audit, internal + client reports, plan, 3 brand directions, 3 x 3 page variations and a live comparison viewer. Plus an unattended **prospect mode** for cron: audit a cold prospect, make a concept, publish a free review, draft an email. |

## Install

In Claude Code:

```
/plugin marketplace add ahadyekta/knowtific-redesign-plugin
/plugin install knowtific-redesign-plugin@knowtific-redesign
```

Restart Claude Code. Requires Node 18.17+. The script dependencies (Playwright, Lighthouse, axe,
Tailwind browser build) and Chromium are installed into the plugin's installed folder the first
time the skill runs. Each new plugin version installs to a new folder, so this repeats once after
an update. To do it by hand: run `npm install` and `npx playwright install chromium` in the
installed plugin's `scripts/` folder.

Update: `/plugin marketplace update knowtific-redesign`, then reinstall or update the plugin.

## Use

Open (or create) a folder for the client project and run:

```
/knowtific-redesign-plugin:redesign https://clientsite.com.au "Client Name"
```

It works through 7 phases and stops for your approval after Discovery, Audit, Plan and Brand.
Everything is written to `redesign/` in the project, and it resumes where it left off.

| Command | Phase |
|---|---|
| `/knowtific-redesign-plugin:redesign <url>` | Run or resume everything |
| `/knowtific-redesign-plugin:discover <url>` | 1. Crawl, competitors, step-by-step interview -> business profile |
| `/knowtific-redesign-plugin:audit` | 2. UI, UX, clarity, conversion, trust, content, SEO, performance, accessibility, mobile, brand, marketing, compliance |
| `/knowtific-redesign-plugin:reports` | 3. Internal agency report + simple client report (HTML + PDF) |
| `/knowtific-redesign-plugin:plan` | 4. Sitemap, page plans, roadmap, KPIs, pick the 3 key pages |
| `/knowtific-redesign-plugin:brand` | 5. 3 brand directions with palette, type, voice and original SVG logos |
| `/knowtific-redesign-plugin:variations` | 6. 3 strategically different layouts for each of the 3 key pages |
| `/knowtific-redesign-plugin:preview [deploy]` | 7. Live viewer: layout x brand x device, ratings, notes, export decision |
| `/knowtific-redesign-plugin:prospect <url> \| next` | Unattended prospect run (see below) |

You can also just ask: "audit and pitch a redesign for example.com.au".

### Prospect mode (unattended)

`/knowtific-redesign-plugin:prospect next` is built to run from cron with `claude -p` while
nobody is at the keyboard. It **never asks a question, never stops at a gate and never contacts
the business** (no email, no forms). One prospect per run:

1. Takes the first unchecked line of `prospects/queue.md` (or, when the queue is empty, finds up to
   5 local businesses for the first `trade | suburb` line in `prospects/targets.md`). Skips
   domains already in `prospects/index.csv` or listed in `prospects/suppression.md`.
2. Lean crawl (12 pages, no photos) + Lighthouse/PSI on the top 3 pages.
3. Site-only discovery: snapshot, 3 competitors, a business profile inferred from the site
   (`[TO CONFIRM]` everywhere it guesses), the email address published on their own site.
4. Capped audit (home, main service, contact + 1) with the normal findings and scorecard. Skips
   chains, franchises, sites that are down or already score 8+.
5. Concept by `depth` in `prospects/config.json`: `audit` (none), `lite` (one "Refresh" brand + one
   home page layout, default) or `full` (3 brands x 3 pages x 3 layouts). Concept pages carry a
   "Design concept by Knowtific - not a live website" banner, `noindex`, visual-only forms and no
   clickable phone numbers.
6. A short, kind, price-free review (`templates/prospect-report.html` -> HTML + PDF), checked by
   `report-reviewer`, published to Cloudflare Pages under `prospects/_site/<slug>-<random>/`
   (the whole `_site/` is deployed each time, `noindex` everywhere). Skipped cleanly without
   Cloudflare credentials.
7. A cold email draft in `prospects/<slug>/email.md` (never sent), the `index.csv` row, a ticked
   queue line, `video-notes.md` (before/after shots and metrics for YouTube) and a 5-line summary.

Assumptions it makes instead of asking go in `redesign/assumptions.md`.

**Workspace starter:** copy `plugins/knowtific-redesign-plugin/templates/prospects-workspace/` to
create the prospects repo on the server (config, targets, queue, suppression list, `index.csv`,
`CLAUDE.md`, the cron runner `run.sh` with lock, timeout, logs and auto-commit, `.env.example`).
Its `README.md` covers the Ubuntu setup. `prospect next` creates any missing workspace file.

**Prospect -> client:** run `/knowtific-redesign-plugin:redesign` inside `prospects/<slug>/`. A
state with `discovery: "site-only"` resumes at the discovery **interview** - no new crawl or audit -
updates the profile and the findings the answers change, then continues with the normal phases,
building on the prospect report and concept.

### The live viewer

`redesign/preview/` is a static site (serve it locally or deploy to Vercel/Netlify/Cloudflare
Pages for the client). It lets reviewers:

- switch page, layout (A/B/C or compare all side by side), brand (A/B/C + Current) and device
- show the current site next to the new layouts
- read what each layout is for and which audit findings it fixes
- rate, take notes, pick a layout per page and a brand
- export `decision.json`, which you drop back into `redesign/` for the build brief

Keyboard: `1-3` layout, `C` compare, `B` next brand, `D/T/M` device.

## What's inside

```
plugins/knowtific-redesign-plugin/
  .claude-plugin/plugin.json
  commands/        slash commands, one per phase
  skills/site-redesign/
    SKILL.md       the orchestrator
    references/    discovery, audit checklists + scoring, report templates, plan, brand, variations, AU compliance
  agents/          page-auditor, technical-auditor, brand-strategist, variation-builder, report-reviewer
  scripts/         crawl, tech-audit (Lighthouse/PSI), build-preview, serve, shoot, to-pdf,
                   prospect (queue/index book-keeping), publish-prospect (deploy to Cloudflare Pages)
  templates/       variation starter (Tailwind wired to brand tokens), brand runtime, viewer, client report,
                   prospect report, prospects-workspace/ (starter repo for cron runs)
```

## Customise

- Agency name/colours on the client report: `templates/client-report.html` (`--agency` CSS variables);
  the prospect report has the same variables in `templates/prospect-report.html`.
- Prospect runs: `prospects/config.json` (depth, pages, sender, Cloudflare project, skip score).
- Pricing/effort guide: `skills/site-redesign/references/report-templates.md`.
- Default strategies for variations: `references/page-variations.md`.
- Audit weighting: `references/audit-checklists.md`.
