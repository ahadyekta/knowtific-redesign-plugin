# Knowtific prospects

Unattended prospecting with the `knowtific-redesign-plugin`. Every ~5 hours cron runs `run.sh`,
which runs `claude -p "/knowtific-redesign-plugin:prospect next"`. Each run takes **one** local
business, audits its public website, makes a design concept, publishes a short free review
to Cloudflare Pages and drafts a cold email in `prospects/<slug>/email.md`. **Nothing is ever
sent.** You review the drafts and send them yourself.

```
run.sh  CLAUDE.md  README.md  .env (yours)  logs/
prospects/
  config.json  targets.md  queue.md  suppression.md  index.csv
  _site/                    everything that is published (deployed whole, every run)
  <slug>/
    redesign/               the plugin's normal workspace (state.json, 01-discovery ... deploy/)
    email.md                the draft (status: draft | no-email)
    video-notes.md          before/after moments and metrics for a video
```

## Server setup (Ubuntu 22.04 / 24.04)

1. **A dedicated low-privilege user.** Even with the tool allowlist, `node` and `npx` can run any
   code, and the run reads untrusted websites. Use a user that can write only this repo:

   ```bash
   sudo adduser --disabled-password --gecos "" prospects
   sudo -iu prospects
   ```

2. **Node 20+** (as that user, with nvm):

   ```bash
   curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   . ~/.nvm/nvm.sh && nvm install 22
   ```

   Cron doesn't load nvm, so put its bin folder in `.env` as `EXTRA_PATH`
   (`dirname "$(which node)"`).

3. **Chromium for Playwright.** System libraries need root once, the browser itself is per user:

   ```bash
   sudo npx -y playwright@1 install-deps chromium      # as an admin user
   npx -y playwright@1 install chromium                # as the prospects user
   ```

   (Or `sudo apt install chromium` and set `CHROME_PATH=/usr/bin/chromium` in `.env`.)

4. **Claude Code and the plugin** (as the prospects user):

   ```bash
   curl -fsSL https://claude.ai/install.sh | bash      # or: npm install -g @anthropic-ai/claude-code
   claude                                              # log in once (or set ANTHROPIC_API_KEY in .env), then /exit
   claude plugin marketplace add ahadyekta/knowtific-redesign-plugin   # or a local path
   claude plugin install knowtific-redesign-plugin@knowtific-redesign
   ```

   The plugin installs its own script dependencies on the first run.

5. **Cloudflare Pages** (optional - without it reports are built but not published):
   - API token: Cloudflare dashboard > My Profile > API Tokens > Create custom token with
     *Account > Cloudflare Pages > Edit*. Account ID: dashboard sidebar.
   - Create the project once (name = `cloudflareProject` in `config.json`):
     `CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npx -y wrangler pages project create knowtific-reviews --production-branch main`
   - Reports land at `https://<project>.pages.dev/<slug>-<random>/`. For your own domain, add it
     to the project in Cloudflare and set `publicBaseUrl` in `config.json`.
   - `_site/_headers` sends `X-Robots-Tag: noindex, nofollow`, `robots.txt` disallows all, and the
     root page is blank, so the reports are unlisted and kept out of search. The random suffix is
     the only thing protecting a report, so treat the links as semi-private.

6. **PageSpeed Insights key** (optional, gives real-visitor data when Google has it): Google Cloud
   console > enable "PageSpeed Insights API" > Credentials > API key.

7. **This repo:**

   ```bash
   cp -r <plugin>/templates/prospects-workspace ~/prospects && cd ~/prospects
   git init && cp .env.example .env && chmod 600 .env && chmod +x run.sh
   # edit .env and prospects/config.json (sender email and phone!), add targets
   git add -A && git commit -m "prospects workspace"
   ./run.sh            # one run in the foreground; the log is in logs/
   crontab -e          # add:  0 */5 * * * /home/prospects/prospects/run.sh
   ```

   Optional: add a private git remote; `run.sh` pulls before each run and pushes after it when
   `GIT_PUSH=1`.

## Permissions

`run.sh` runs Claude with `--permission-mode dontAsk` and an explicit `--allowedTools` list
(Bash for `node`, `npx`, `npm`, `git`, `mkdir`, `cp`, `mv`, `ls`, `cat` and a few read-only
commands; Read, Write, Edit, Glob, Grep, WebSearch, WebFetch, subagents, skills). Anything else is
denied without a prompt, `AskUserQuestion` is disallowed, and `--strict-mcp-config` loads no MCP
servers (so no mail or chat connectors exist in the run). If a run keeps failing on a denied tool
(check the log; `VERBOSE=1 ./run.sh` logs every tool call), you can set `SKIP_PERMISSIONS=1` in
`.env` to use `--dangerously-skip-permissions` instead. Then it is essential that it runs as the
dedicated user above, with only this repo writable and no sudo.

## Day to day

- **Add work:** put searches in `prospects/targets.md` as `- [ ] plumber | Lilydale`, or
  specific sites in `queue.md` as `- [ ] https://site.com.au | Name | trade | suburb`.
- **Review drafts:** open `prospects/index.csv` (one row per prospect: score, top issue, email,
  report link, status). For each `done` row, open `prospects/<slug>/email.md`, check the report
  link and the PDF (`redesign/03-reports/prospect-report.pdf`), edit, and send it yourself with
  the PDF attached. Change `status:` to `sent` (and the date) so you know.
- **Never contact them again** if they reply "no thanks": add their domain to `suppression.md`.
  Rows with `status: no-email` had no published address - leave them, or call if appropriate.
- **Spam Act:** a cold business email relies on inferred consent - the address was conspicuously
  published, the email is about their business, it identifies you and has a working unsubscribe.
  The run already drops addresses from sites that say they don't want unsolicited email. Not
  legal advice.
- **Usage limits and interrupted runs:** a lite prospect is a big job (crawl, 5-6 subagents, a
  concept page, a report). On a Claude subscription a run can hit the 5-hour usage limit part-way
  ("You've hit your 5-hour limit" in the log). Nothing is lost: `run.sh` commits the partial
  work, the queue line stays unchecked, and the next cron run resumes that prospect from its
  `state.json` (after 3 attempts it is finished as `partial`). For predictable runs use an API
  key in `.env` with `MAX_BUDGET_USD`, or space the cron runs out.
- **Logs:** `logs/YYYY-MM-DD_HHMM.log`. `logs/overlap.log` lists runs skipped because the previous
  one was still going.

## When a prospect becomes a client

```bash
cd ~/prospects/prospects/<slug>
claude
> /knowtific-redesign-plugin:redesign
```

It resumes from the saved work: the crawl, snapshot, competitors and audit are reused, it starts
with the discovery **interview**, updates the business profile and findings, then continues with
the full engagement (reports, plan, 3 brands x 3 pages x 3 layouts, viewer). The prospect concept
becomes brand direction B and the starting point for one home layout.
