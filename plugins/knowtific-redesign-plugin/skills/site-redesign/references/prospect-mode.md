# Prospect mode (unattended)

A cold prospect is a local business that has never spoken to Knowtific. The run audits their
public website, makes a concept, publishes a short, kind review and drafts an email that Ahad
reviews and sends by hand later. It runs from cron with `claude -p`: **nobody is at the keyboard**.
Everything is saved so that, if the prospect becomes a client, the normal `redesign` command
resumes from this work (see "When a prospect becomes a client").

## Rules (these override the normal ground rules)

1. **Never ask, never wait.** No AskUserQuestion, no gates, no "shall I continue". When something
   is unknown, make the most reasonable assumption, append it to `redesign/assumptions.md`
   (`- <phase>: <assumption> - because <evidence>`) and carry on. Unknown business facts are
   `[TO CONFIRM]` as usual.
2. **Never contact the business.** Never send email, SMS or messages, never submit a form on the
   prospect's site (the crawler doesn't either), never call, book, subscribe or post. Reading their
   site and public search results is fine. Publishing the report with `publish-prospect.mjs` is
   the only outward action allowed.
3. **One prospect per run.** Finish (or skip) one, do the book-keeping, print the summary, stop.
4. **Partial beats crashed.** A permission denial is not a failure: the cron run allows Bash
   commands by their first word (`node`, `npx`, `npm`, `git`, `mkdir`, `cp`, `mv`, `ls`, `cat`...),
   so rewrite a denied command as one simple command and carry on (see "Shell commands"). If a step
   really fails, retry once. If it fails twice, push
   `{"phase": "...", "error": "...", "at": "<ISO time>"}` onto `state.errors`, set the phase to
   `failed` and continue with what exists. The run must always reach step 8.
5. **Time budget.** The cron runner kills the run after 4 hours. Aim for: crawl + tech 20 min,
   discovery 20 min, audit 45 min, concept 60 min (lite), report + publish 40 min. If a phase runs
   far over, wrap it up with what you have.
6. **Evidence only.** Everything in the report comes from the site, the crawl, the audit or public
   research. No interview claims, no guessed revenue or job values, no invented reviews, licences,
   prices or numbers.

## Paths and tools

`S` = `${CLAUDE_PLUGIN_ROOT}/scripts` (resolve it once as SKILL.md says). The workspace root is
`prospects/` in the current folder; `P` = `prospects/<slug>`; `RD` = `P/redesign` (the normal
layout from SKILL.md). Book-keeping is done only with `node S/prospect.mjs` - never edit
`queue.md`, `targets.md` or `index.csv` by hand:

| Command | Does |
|---|---|
| `prospect.mjs init` | creates missing `config.json`, `targets.md`, `queue.md`, `suppression.md`, `index.csv`, `_site/` guards |
| `prospect.mjs next` | JSON: the first usable queue item (ticks suppressed/duplicate lines on the way), or `{"empty": true, "target": ...}` |
| `prospect.mjs check <url> ["Business"]` | `{ok, reason}` against `index.csv` and `suppression.md` |
| `prospect.mjs slug "Business" "Suburb" --url <url>` | free folder slug (reuses the folder of the same domain) |
| `prospect.mjs queue-add <url> "Business" "trade" "suburb"` | appends a candidate unless duplicate/suppressed |
| `prospect.mjs tick <url> --note "..."` / `tick-target "trade \| suburb"` | ticks a line with a note |
| `prospect.mjs crawl-check P` | is the crawl usable (down / blocked / parked)? |
| `prospect.mjs contact P` | emails and phones published on the site, with the page found on |
| `prospect.mjs index P` | upserts the `index.csv` row from state, scorecard and findings |

**Shell commands.** Unattended runs only allow Bash commands that start with an allowed program.
Write every command as one simple call with the script's absolute path written out, e.g.
`node "/home/prospects/.claude/plugins/cache/.../scripts/prospect.mjs" next` - never `S=...;`,
`export`, `$(...)` or backticks, and chain only allowed commands. Use Read, Glob and Grep rather
than `cat`/`ls`/`grep` where you can. Paths below write `S/...` for brevity only.

Read `prospects/config.json` (defaults: `depth` `lite`, `maxPages` 12, `minScoreToSkip` 8,
`candidatesPerTarget` 5, `sender`, `cloudflareProject`).

## Step 0 - Pick the prospect and set up

1. `node S/prospect.mjs init`.
2. **`next`:** run `prospect.mjs next`.
   - Not empty: use its `url`, `business`, `trade`, `suburb`, `slug`.
   - Empty with a `target`: web search for the target (`<trade> <suburb>`, `<trade> near <suburb>
     VIC`, the Maps pack). Pick up to `candidatesPerTarget` **independent local businesses with
     their own website** in or near that suburb. Leave out franchises and national chains,
     directories and lead-gen sites (hipages, Oneflare, Yellow Pages, ServiceSeeking...), businesses
     with only a Facebook or Google page, and anything in `suppression.md`. For each:
     `prospect.mjs queue-add <url> "Business" "trade" "suburb"`. Then
     `prospect.mjs tick-target "<trade> | <suburb>" --note "searched <date>, <n> added"` and run
     `next` again. If no candidate was found, tick the target with that note and try the next
     target once; if still nothing, end the run with the summary ("no prospects found").
   - Empty and no target: end the run with the summary "queue and targets are empty".
3. **`<url>`:** run `prospect.mjs check <url>`; if not ok, print the reason and end. Business name
   from the argument, or from the site title. Suburb: WebFetch the home page if you need it for the
   slug. Then `prospect.mjs slug "<business>" "<suburb>" --url <url>`.
4. Create `P/` and `RD/`. If `RD/state.json` exists with `mode: "prospect"`, this is a retry of an
   interrupted run: increase `prospect.attempts`; if it is now 3 or more, skip straight to step 8
   and finish as `partial` with what exists. Otherwise resume from the first step not done.
   New prospect: write `RD/state.json` (schema at the end) and an empty `RD/assumptions.md`.
5. First run of the scripts on this machine:
   `npm --prefix "S" install --no-audit --no-fund` and `npx --prefix "S" playwright install chromium`
   (skip if `S/node_modules` exists).

## Step 1 - Crawl (lean)

```bash
node "S/crawl.mjs" <url> --out RD/02-audit/crawl --max <maxPages> --no-images --priority
node "S/prospect.mjs" crawl-check P
node "S/tech-audit.mjs" --pages RD/02-audit/crawl/pages.json --out RD/02-audit/tech --top 3 --psi
```

- `--priority` crawls the pages an audit needs first (home, contact, quote, services, about).
- If the crawl fails twice, or `crawl-check` says not ok: **skip** (site down or blocking).
- PSI uses `PSI_API_KEY` from the environment when set. Lighthouse or PSI failures never stop the
  run: note them in `state.errors` and carry on with whatever `tech/summary.json` has.
- Photos are not downloaded here; the normal flow fetches them later if they become a client.

## Step 2 - Discovery (site-only)

Follow `references/discovery.md` **steps 1, 2 and 4 only** - no interview.

1. `01-discovery/site-snapshot.md` from the crawl (step 1, including the 5-second clarity test).
2. `01-discovery/competitors.md`: web search `<main service> <suburb>`; pick **3** real local
   competitors with websites (not directories), read their home pages with WebFetch (don't crawl
   them), note positioning, offer, proof, CTA, better/worse, and the shelf test.
3. `01-discovery/business-profile.md` from the template, built only from the site and research.
   Every inferred fact is marked `[TO CONFIRM]` (job values, margins, capacity, sales process,
   marketing spend, goals...). Header line: `_Sources: site crawl and public research only - no
   interview yet (prospect mode)_`. The "Open questions for the client" list is the interview
   agenda for later.
4. `01-discovery/questions.md`: just the heading and "No interview yet (prospect mode)".
5. **Contact:** `prospect.mjs contact P`. Use only an address published on the business's own site
   (mailto link or visible text). Prefer `best`; record `contact.email`, `contact.foundOn` (the
   page URL) and `contact.phone`. If there is none, `contact.email` is `null` - still finish the
   prospect. If the site asks not to receive unsolicited or marketing email ("no solicitations",
   "no marketing emails"), set `contact.email` to `null` and record why in `contact.note` (Spam
   Act: no inferred consent then).
6. **Skip** now if the site shows it is not a small/medium local business: a franchise or national
   chain (franchise pages, many locations across states, a head office brand), a government body,
   a directory or lead-gen site, or a large company. Also skip an **existing Knowtific client**
   (the site credits Knowtific, e.g. "Designed and built by Knowtific") unless the run's
   arguments say it is a test run approved by Ahad.

Set `phases.discovery` to `"site-only"`.

## Step 3 - Audit (capped)

Same checklist, rubric, `findings.json` and `scorecard.json` as normal (`references/audit-checklists.md`).

- `page-auditor` on **at most 4 pages**: home, the main money service page, the contact/quote
  page, and one more only if clearly important. Tell each agent the business profile is inferred
  from the site only. Launch them and `technical-auditor` together.
- Depth `audit` or `lite`: **no `brand-strategist`.** Do the brand review in the main session
  (positioning, messaging, logo, visual identity, funnel - the agent's audit-mode list) and write
  it to `02-audit/page-notes/_brand.md` with `brand` and `marketing` scores. Depth `full`: launch
  `brand-strategist` as normal.
- Merge into `findings.json` and `scorecard.json` (with `clientSummary` and `screenshot` on every
  P1/P2 finding - the report uses them). Set `phases.audit` to `"done"`.
- **Skip** if `scorecard.overall >= minScoreToSkip` ("already excellent"). Keep the audit files.

## Step 4 - Concept (by depth)

### Concept rules (all depths that build pages)

- Real copy written from their site, in their voice, Australian English. No lorem ipsum.
- Never invent reviews, ratings, licences, prices, years or numbers: use `.tbc` placeholders
  (`<span class="tbc">[TO CONFIRM: licence number]</span>`) or real reviews quoted on their site.
- Every page has, in `<head>`: `<meta name="robots" content="noindex">`, and just before `</body>`:

  ```html
  <div class="rd-concept-banner" role="note">Design concept by Knowtific - not a live website</div>
  <style>.rd-concept-banner{position:fixed;z-index:9999;left:50%;transform:translateX(-50%);bottom:12px;background:rgba(17,17,17,.88);color:#fff;font:600 12px/1.2 system-ui,sans-serif;padding:7px 12px;border-radius:999px;pointer-events:none;white-space:nowrap}@media (max-width:767px){.rd-concept-banner{bottom:76px}}</style>
  ```

- Forms are visual only: no `action`, every submit button `disabled`, other buttons `type="button"`,
  no script that sends data.
- Phone numbers and emails are plain text, never `tel:`, `mailto:` or `sms:` links (a concept must
  not dial the real business). Buttons such as "Call now" are `<span>`/`<a href="#">` styled as
  buttons.
- `build-preview.mjs` enforces all of this when `state.mode` is `prospect` - fix every error.

### `audit`

Skip the concept. `brand`, `variations`, `preview` stay `"todo"`.

### `lite` (default)

1. **One brand direction, "Refresh"** (keep their equity, fix the problems). Write
   `05-brand/brands.json` with one brand, `"id": "b"`, `"name": "Refresh"`, full schema from
   `references/brand-directions.md`: start from `crawl/brand-current.json` `suggestedTokens`,
   keep their hues, fix every contrast pair, pick a better type pair. Tagline from their own
   words - no new claims. Logo: `"logo": {"useCurrent": true}` (the viewer uses their crawled
   logo) **unless the audit found the current logo weak** (a `brand` finding about the logo with
   impact medium or high, or no usable logo saved): then draw an original concept logo set
   (`logos/b-primary.svg`, `b-mark.svg`, `b-on-dark.svg`) keeping the name exactly as written.
2. `state.keyPages = [{"slug": "home", "label": "Home", "currentSlug": "home"}]`.
3. **One home page variation.** Choose the strategy from `references/page-variations.md` that best
   fixes the top findings; one line of why goes in `assumptions.md`. Launch **one**
   `variation-builder` agent: slug `home`, build **only `a.html`** with that strategy, the concept
   rules above, `brands.json`, `findings.json` (the home + sitewide P1/P2 IDs), the profile, and no
   plan (use the section order from its page-notes recommendation). No client photos exist yet:
   prefer typographic or colour-block heroes and use at most 2 `rd-ph` photo placeholders.
   With `useCurrent` logos, never put the logo on a dark background (a raster logo usually has
   dark text); use `data-brand-logo="primary"` on a light surface in the footer too.
4. Screenshots: `node "S/shoot.mjs" RD/06-variations/home/a.html --out RD/06-variations/home/_shots --widths 390,1440 --fold`
   (no `--brand`, so the files are `a--390.png`, `a--390-fold.png`, `a--1440.png`, `a--1440-fold.png`).
   Look at them; fix overflow, hidden CTA, anything that looks templated.
5. `node "S/build-preview.mjs" RD` - fix every error and warning that matters.
6. Phases: `brand`, `variations`, `preview` = `"concept"`; `plan` stays `"todo"`.

### `full`

Write a short `04-plan/plan.md` (the 3 key pages with reasons and their section plans only) and set
`plan` to `"concept"`. Then run the normal phases 5 and 6 (3 brands x 3 key pages x 3 layouts, the
`variation-builder` agents in parallel) **without gates**, with the concept rules, then
`build-preview.mjs`. Shoot every `a/b/c` with `--fold`. `brand`, `variations`, `preview` = `"concept"`.

## Step 5 - Prospect report

Build `03-reports/prospect-report.html` from `${CLAUDE_PLUGIN_ROOT}/templates/prospect-report.html`.
It goes to a business that did NOT ask for it: short, kind, factual, **no prices, no packages**.

1. **Cover**: business name, "A free review of your website", desktop + mobile fold screenshots.
2. **What we see on your website**: what they do, for whom, where, how visitors contact them -
   only from the site. Lead with genuine strengths. No interview claims, no `[TO CONFIRM]` facts.
3. **Scorecard**: max 8 bars (merge dimensions), plain-English reasons, the note on what 5 and 8 mean.
   Numbers must match `scorecard.json`.
4. **3-5 issues most likely costing enquiries**, each with a screenshot and a one-sentence fix
   (from the P1/P2 findings, `clientSummary` wording). Max 3 per page.
5. **Speed and Google**: Lighthouse mobile scores and LCP ("the main picture appears after 4.8 s")
   in plain words. Label clearly: lab test (Lighthouse/PSI lab) vs real-visitor data (PSI field
   data / CrUX); if there is no field data, say so.
6. **Quick wins they could do this week**, even without us (3-5, concrete).
7. **Before / after** (lite/full): current home vs the concept, desktop and mobile fold shots.
8. **How you compare locally**: 2-3 competitors from `competitors.md`, facts only, no trash talk.
9. **One next step**: reply to the email or book a 15-minute call. Sender from `config.sender`
   (leave out empty fields; if email and phone are both empty, use the website and log it).

Footer on every page: date and "Based on the public website on <date>". Australian English.
Leave the `data-fill` links and `data-needs-url` blocks in place - the publish step fills them.

Then `node "S/to-pdf.mjs" RD/03-reports/prospect-report.html` and launch `report-reviewer` in
**prospect mode** on it. Fix what it flags, **once** (no second review loop).
Set `phases.reports` to `"prospect"` (the internal and client reports are still to do).

## Step 6 - Publish

```bash
node "S/publish-prospect.mjs" P
```

It builds `RD/deploy/` (`index.html` with every image copied into `deploy/img/` and paths
rewritten, `report.pdf` re-rendered with the public links, `concept/` = the built preview), checks
that no path leaks outside `deploy/`, copies it to `prospects/_site/<slug>-<8 random chars>/` (the
same folder on re-runs), keeps `_site/_headers` (`X-Robots-Tag: noindex, nofollow`),
`_site/robots.txt` (disallow all) and a blank `_site/index.html`, and deploys the **whole**
`prospects/_site` with `npx wrangler pages deploy prospects/_site --project-name <cloudflareProject>
--branch main`. Without `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` it skips the deploy
cleanly and sets `report.url` to `null`. It writes `state.report` itself.

- Exit code 2 = problems listed (missing image, leaked path): fix the report and run it once more.
- Check the result: `node "S/shoot.mjs" RD/deploy/index.html --out RD/_checks --widths 390,1440`
  and look at both screenshots - every image must show, nothing may overflow at 390.
- A deploy failure is logged in `state.report.deployError`; continue (the email then has no link).

## Step 7 - Email draft (never sent)

Write `P/email.md`. If the `knowtific-marketing-kit` plugin's `outbound` skill is available, read
it and follow its rules; these limits always apply:

- Subject under 7 words, true, not deceptive (no "Re:", no fake urgency).
- First line: one specific, true observation from the audit (name the page or the thing).
- Body under 100 words, plain text, kind. The report link (only if `report.url` is set) and a note
  that the PDF review is attached. One soft ask (reply, or a 15-minute call).
- Sender name, business and contact details from `config.sender`.
- Last line: `Reply "no thanks" and I won't contact you again.`

```markdown
---
to: info@smithplumbing.com.au        # null when no published email
foundOn: https://smithplumbing.com.au/contact
subject: Your website's mobile call button
reportUrl: https://knowtific-reviews.pages.dev/smith-plumbing-lilydale-k3f9x2qa/   # null if not published
pdf: redesign/03-reports/prospect-report.pdf
status: draft                        # no-email when to is null
---

Hi <first name if published on the site, else "there">,
...
```

## Step 8 - Book-keeping and summary

1. Set `status` (`done`; `partial` if any phase is `failed` or the run gave up; `skipped`),
   `prospect.finishedAt`, `updated`.
2. `node "S/prospect.mjs" index P`.
3. `node "S/prospect.mjs" tick <url> --note "<status> <date> (<slug>, <overall>/10)"` (no-op for a
   URL that was not in the queue).
4. `P/video-notes.md` (not for skips without an audit): 5-8 bullets - the most visual before/after
   moments with screenshot paths (current fold vs concept fold, desktop and mobile, the worst
   issue screenshot), the key metrics (overall score and the worst dimension, mobile performance
   score, LCP, accessibility violations, whether a phone visitor can call from the first screen),
   and one "story" line for the video.
5. Print exactly 5 lines to stdout:

```
Prospect: <Business> (<slug>) - <url>
Result: <status> | depth <depth> | overall <x>/10 | top issue: <title>
Report: <report.url or "not published: <reason>">
Email: <"draft to <to>" or "no published email"> - prospects/<slug>/email.md
Next: <n> unchecked in queue | errors: <none or short list>
```

## Skipping a prospect

Skip when: the site is down or blocks the crawl; it is not a small/medium local business; it is a
franchise or national chain; it is already a Knowtific client; it already looks excellent (`overall >= minScoreToSkip`); it is in
`suppression.md`; or its domain is already in `index.csv`. `prospect.mjs next` handles the last two
before any folder exists (it ticks the queue line with the reason and moves on - an existing
prospect's folder is never touched). For the others: set `status: "skipped"` and `skipReason`,
keep what was produced, no report, no email, then step 8 (index row, tick, summary) and end the run.

## state.json in prospect mode

```json
{
  "mode": "prospect",
  "depth": "lite",
  "status": "in_progress",
  "skipReason": null,
  "site": "https://smithplumbing.com.au",
  "client": "Smith Plumbing",
  "prospect": {"trade": "plumber", "suburb": "Lilydale", "source": "queue", "attempts": 1,
               "startedAt": "2026-10-30T02:00:00Z", "finishedAt": null},
  "contact": {"email": "info@smithplumbing.com.au", "foundOn": "https://smithplumbing.com.au/contact", "phone": "0398765432"},
  "report": {"url": null, "pdf": "03-reports/prospect-report.pdf", "dir": null},
  "phases": {"discovery": "site-only", "audit": "done", "reports": "prospect", "plan": "todo",
             "brand": "concept", "variations": "concept", "preview": "concept"},
  "keyPages": [{"slug": "home", "label": "Home", "currentSlug": "home"}],
  "errors": [],
  "updated": "2026-10-30"
}
```

Phase values: `todo`, `site-only` (discovery without interview), `done`, `prospect` (only the
prospect report exists), `concept` (a prospect concept exists, not the full deliverable),
`failed`.

## When a prospect becomes a client

Ahad runs `/knowtific-redesign-plugin:redesign` inside `prospects/<slug>/`. The normal flow then:

1. Sets `mode` to `"client"` (keeps the `prospect`, `contact` and `report` blocks as history) and
   tells the user it is resuming a prospect.
2. Treats the crawl, snapshot, competitors and audit as done. `discovery: "site-only"` means:
   run **only the interview rounds** (discovery step 3), skipping questions the site already
   answered and starting from the profile's open questions; then update `business-profile.md`
   (replace `[TO CONFIRM]` facts with answers, keep the rest) and update the findings and scores
   the answers change (e.g. a different money service changes priorities), noting each change in
   `questions.md`. Then the discovery gate, and `discovery: "done"`.
3. `reports: "prospect"` -> write the internal and client reports as normal.
4. Before variations, fetch the photos the lean crawl skipped:
   `node S/crawl.mjs <url> --out redesign/02-audit/crawl-photos --max 40 --no-shots --no-axe --no-linkcheck`
   then copy `crawl-photos/images/*` into `crawl/images/`.
5. `brand: "concept"` -> phase 5 keeps "Refresh" as direction B and adds A and C;
   `variations: "concept"` -> phase 6 uses `home/a.html` as the starting point for one layout.
