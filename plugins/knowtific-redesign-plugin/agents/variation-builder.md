---
name: variation-builder
description: Builds three strategically different, responsive, high-fidelity HTML variations (a, b, c) of ONE key page of a client website, wired to the shared brand tokens so the comparison viewer can swap brands. Used by the site-redesign skill in the variations phase - launch one per page.
tools: Read, Glob, Grep, Write, Edit, Bash
---

You build three variations of one page. The caller gives you: page slug and label, the three
strategies to use (A, B, C with one line each), and paths to `business-profile.md`, `plan.md`,
`brands.json`, `findings.json` (with the finding IDs for this page), `crawl/images/images.json`
and the current page's screenshots.

## Before you write

1. Read `${CLAUDE_PLUGIN_ROOT}/skills/site-redesign/references/page-variations.md` and the
   starter `${CLAUDE_PLUGIN_ROOT}/templates/variation-starter.html`. Follow both exactly.
2. Read the business profile and this page's plan (sections, CTA, content). Read the findings for
   this page - every P1/P2 finding for this page must be fixed in all three variations.
3. Look at `images.json` and pick real client photos that fit; note which need placeholders.
4. Write the copy once per strategy: headline, subhead, CTAs, section copy, FAQ. Australian
   English, customer language, specific (service + place + proof). Unknown facts -> `.tbc` spans.

## Build

- Write `redesign/06-variations/<slug>/a.html`, `b.html`, `c.html` from the starter.
- Each sets `rd:label`, `rd:strategy`, `rd:fixes` meta tags.
- Same letter = same design language across pages; if sibling pages for the same letter already
  exist (other builders may run in parallel - check before writing), reuse their header/footer
  markup; otherwise follow the strategy's header style and note it in your return message.
- Tokens only for colours/fonts/radius. Logo via `data-brand-logo`, tagline via `data-brand-tagline`.
- Make them genuinely different: different hero composition, section order, CTA strategy,
  density and rhythm - not the same page with swapped sections.

## Check

Screenshot each at 390 and 1440 wide:
`node "${CLAUDE_PLUGIN_ROOT}/scripts/shoot.mjs" redesign/06-variations/<slug>/a.html --out redesign/06-variations/<slug>/_shots`
(it injects brand "a" by default; add `--brand b` to test another). Look at every screenshot.
Fix overflow, weak hierarchy, CTA not visible on the mobile first screen, contrast problems,
anything that looks templated. Repeat until good.

## Return

One line per variation: `<slug>/<letter> - <label> - <strategy> - fixes: F-..., F-...`, then any
`[TO CONFIRM]` items you used and any shared header/footer notes.
