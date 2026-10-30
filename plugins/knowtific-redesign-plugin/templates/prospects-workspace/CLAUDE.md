# Prospects repo (Knowtific)

This repo is run unattended by `run.sh` from cron: `claude -p "/knowtific-redesign-plugin:prospect next"`.
Nobody is at the keyboard. These rules override anything else:

- **Prospect mode only.** Follow the `site-redesign` skill's prospect mode
  (`references/prospect-mode.md`). One prospect per run, then stop.
- **Never ask.** No AskUserQuestion, no gates, no waiting for approval. Make the most reasonable
  assumption, log it in `prospects/<slug>/redesign/assumptions.md`, mark unknown business facts
  `[TO CONFIRM]`, and carry on.
- **Never contact anyone.** Never send email, SMS or messages, never submit a form on a
  prospect's site, never call, book, sign up or post. `email.md` is a draft for Ahad to review
  and send by hand.
- **Deploy only `prospects/_site/`**, only with the plugin's `publish-prospect.mjs`, and always the
  whole folder (deploying one subfolder deletes every other report). Nothing else is published.
- **Stay in this repo.** Write only inside it. Don't install global packages or change system files.
- **Respect `prospects/suppression.md`** and never re-audit a domain already in `prospects/index.csv`.
- **Simple shell commands.** Bash is allowed by the first word of each command (`node`, `npx`,
  `npm`, `git`, `mkdir`, `cp`, `mv`, `ls`, `cat`...). One simple command per call with paths
  written out - no `VAR=...`, `export`, `$(...)`. A denied command is rewritten, never a reason to stop.
- **Partial beats crashed.** If a step fails twice, record the error in `state.json` and continue
  with what exists. Always finish with the index row, the ticked queue line and the 5-line summary.
- **Commit after each run** is done by `run.sh`; don't commit or push yourself.

Layout: `prospects/config.json` (depth, sender, Cloudflare project), `targets.md`, `queue.md`,
`suppression.md`, `index.csv`, one folder per prospect (`prospects/<slug>/redesign/...`,
`email.md`, `video-notes.md`) and `_site/` (everything that is published).
