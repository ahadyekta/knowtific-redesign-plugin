---
description: Phase 2 - audit every important page across UI, UX, clarity, conversion, content, SEO, performance, accessibility, mobile, brand, marketing and compliance
argument-hint: [extra focus, e.g. "focus on landing pages"]
---

Use the `site-redesign` skill and run **Phase 2 - Audit**. Extra focus from the user: $ARGUMENTS
Requires `redesign/02-audit/crawl/pages.json` (run the crawl first if missing) and ideally
`redesign/01-discovery/business-profile.md` (if missing, warn that findings will be less business-
specific and offer to run discovery first).
Run the tech audit, fan out `page-auditor` agents (max 5 at once) plus `technical-auditor` and
`brand-strategist`, then merge into `findings.json` and `scorecard.json`. Stop at the gate.
