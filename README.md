# Knowtific Claude Code plugins

Private plugin marketplace for Knowtific client work.

| Plugin | What it does |
|---|---|
| `knowtific-redesign-plugin` | Full redesign engagement for an existing client website: business discovery, audit, internal + client reports, plan, 3 brand directions, 3 x 3 page variations and a live comparison viewer. |

## Install

Put this folder somewhere permanent (or push it to a private GitHub repo), then in Claude Code:

```
/plugin marketplace add ~/path/to/knowtific-redesign-plugin        # or: /plugin marketplace add your-org/knowtific-redesign-plugin
/plugin install knowtific-redesign-plugin@knowtific
```

Restart Claude Code, then install the script dependencies once:

```bash
cd ~/path/to/knowtific-redesign-plugin/plugins/knowtific-redesign-plugin/scripts
npm install
npx playwright install chromium
```

Requires Node 18.17+.

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

You can also just ask: "audit and pitch a redesign for example.com.au".

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
  scripts/         crawl, tech-audit (Lighthouse/PSI), build-preview, serve, shoot, to-pdf
  templates/       variation starter (Tailwind wired to brand tokens), brand runtime, viewer, client report
```

## Customise

- Agency name/colours on the client report: `templates/client-report.html` (`--agency` CSS variables).
- Pricing/effort guide: `skills/site-redesign/references/report-templates.md`.
- Default strategies for variations: `references/page-variations.md`.
- Audit weighting: `references/audit-checklists.md`.
