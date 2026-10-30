---
description: Unattended prospect run (cron-safe) - audit one cold prospect's website, make a concept, publish a short free review and draft a cold email for review. Never asks questions, never sends anything.
argument-hint: <url> ["Business name"] | next
---

Use the `site-redesign` skill in **prospect mode** for: $ARGUMENTS

Read `references/prospect-mode.md` first and follow it exactly. Nobody is at the keyboard:

- **Never** use AskUserQuestion, never stop at a gate, never wait for approval. Assume, log it in
  `redesign/assumptions.md`, mark unknown facts `[TO CONFIRM]`, carry on.
- **Never** send email or messages, submit forms on the prospect's site, or contact the business.
  The only outward action is publishing with `publish-prospect.mjs`.
- **One prospect per run.** Use `node "${CLAUDE_PLUGIN_ROOT}/scripts/prospect.mjs"` for the queue,
  targets, suppression list, duplicate checks, slug, contact email and `index.csv`.

Argument:
- `next` (or nothing): `prospect.mjs next` gives the first usable line of `prospects/queue.md`.
  If the queue is empty it gives the first unchecked line of `prospects/targets.md`: find up to 5
  candidate businesses with web search, add them with `prospect.mjs queue-add`, tick the target
  with `prospect.mjs tick-target`, then run `next` again and process the first new item.
- `<url> ["Business name"]`: run that site (after `prospect.mjs check <url>`).

Create a task list with one item per step (pick, crawl, discovery, audit, concept, report,
publish, email, book-keeping). Whatever happens, finish with the book-keeping step and the
5-line summary from `references/prospect-mode.md`.
