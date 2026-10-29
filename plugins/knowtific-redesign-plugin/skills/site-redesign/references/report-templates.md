# Report templates

Two reports from the same `findings.json`. Same facts, different job:

| | Internal report (agency) | Client report |
|---|---|---|
| Reader | Knowtific team | Business owner, not technical |
| Job | Decide what to do, price it, plan the pitch | Feel understood, see the cost of doing nothing, say yes |
| Tone | Blunt, technical, complete | Warm, plain, confident, short |
| Length | As long as needed | 6-10 pages printed, mostly visuals |
| Shows | Every finding, effort, upsells, risks | Top 5 problems, quick wins, the plan, 3 packages |

## Internal report - `03-reports/internal-report.md`

```markdown
# <Client> - redesign audit (internal)
Site: <url> - Crawled <n> pages on <date> - Overall <x>/10

## TL;DR
3-5 bullets: the real problem (often positioning or conversion, not looks), the biggest money
leak, what we should sell first, deal size range, risk.

## Business recap
Positioning statement, money services, primary conversion, constraints (link business-profile.md).

## Scorecard
Table: dimension | score | one-line reason.

## Root causes
Group findings into 3-6 root causes (e.g. "no positioning", "page builder bloat", "no landing
pages for ads", "no tracking"). Each: findings it explains, business effect.

## All findings
Table sorted by priority: ID | priority | dimension | title | pages | effort | service.
Then details per P1/P2 finding: evidence, why, fix.

## Quick wins (P1/P2 with effort S)
Things we can fix in week 1 (even before the rebuild) - good for trust and a paid audit offer.

## What we can sell
| Service | Why this client needs it (finding IDs) | Scope | Est. hours | Price range (AUD) |
Website rebuild, landing pages, local SEO, Google Ads, CRM setup, AI automations (chat/SMS
speed-to-lead, review requests), branding, copywriting, photography, care plan/hosting.
Recommend a sequence (what first, what after 90 days).

## Packages for the client report
Good / Better / Best with what's in each and price range. Note which we want them to pick and why.

## Risks and dependencies
Content they must supply, access needed (domain, GBP, GA4, Search Console, CMS), URL migration
and redirects, compliance, timeline risks.

## Meeting prep
Open questions, likely objections and answers, what to show first (usually the mobile hero and
the competitor comparison).
```

Effort guide (adjust per agency rates): page design+build 4-8 h/page, landing page 6-10 h,
copy 1-2 h/page, local SEO setup 8-15 h, GA4/GTM/conversions 3-6 h, CRM + automations 8-20 h,
logo + mini brand guide 10-20 h.

## Client report - `03-reports/client-report.html`

Build from `${CLAUDE_PLUGIN_ROOT}/templates/client-report.html` (fill the `{{...}}` blocks and
repeat the marked sections). Rules:

- **Lead with them, not us.** First page: "What we learned about <Business>" - their customers,
  their strengths. Shows we listened. Then the gap.
- **Plain words.** No acronyms without explanation (LCP -> "how fast the main picture appears").
  Use `clientSummary` from findings.
- **Show, don't tell.** Every problem has a screenshot (crop/annotate if possible) or a number.
- **Respectful.** Never mock the current site or whoever built it. "Your site was built for a
  different stage of the business" beats "your site is outdated".
- **Money framing.** Where possible, translate to enquiries: "If 1,000 people visit a month and 2
  in 100 enquire, that's 20 leads. Getting that to 4 in 100 doubles leads with no extra ad spend."
  Use their real numbers if known, otherwise clearly say it's an example.
- **Top 5 only** for problems. Everything else is "and 37 smaller fixes we'll handle".
- **Scorecard** as simple bars with traffic-light colours, max 8 dimensions (merge the rest).
- **Competitor glance**: 2-3 competitors, what they do that the client doesn't (no trash talk).
- **The plan in 3 steps** (Fix -> Rebuild -> Grow) with timeframes.
- **3 packages** (Essentials / Growth / Premium style) with outcomes first, features second.
  Mark one "Recommended".
- **One clear next step** ("Book a 30-min walkthrough of the new designs").
- Australian English, AUD, GST note on prices.

After writing, render the PDF and launch `report-reviewer`. Fix everything it flags.
