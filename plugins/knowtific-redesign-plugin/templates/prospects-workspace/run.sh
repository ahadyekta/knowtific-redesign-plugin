#!/usr/bin/env bash
# Cron runner for unattended prospect runs: one prospect per run, never asks, never sends.
#
#   crontab -e   (as the dedicated prospects user)
#   0 */5 * * * /path/to/prospects/run.sh
#
# Settings come from .env next to this file (see .env.example). Useful overrides:
#   CLAUDE_BIN=echo ./run.sh        dry run: prints the claude command instead of running it
#   PROSPECT_PROMPT='/knowtific-redesign-plugin:prospect https://site.com.au "Name"' ./run.sh
#   RUN_TIMEOUT=4h  MAX_BUDGET_USD=20  CLAUDE_MODEL=...  VERBOSE=1 (full transcript in the log)
#   SKIP_PERMISSIONS=1   use --dangerously-skip-permissions instead of the allowlist (see README)
#   GIT_PUSH=1           push after committing
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO" || exit 1
mkdir -p logs

# ---- one run at a time: overlapping cron runs exit immediately ----
LOCK="$REPO/logs/.run.lock"
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK"
  if ! flock -n 9; then echo "$(date '+%F %T') previous run still active - exiting" >> logs/overlap.log; exit 0; fi
else
  # no flock (macOS, Git Bash): atomic mkdir lock
  if ! mkdir "$LOCK.d" 2>/dev/null; then echo "$(date '+%F %T') previous run still active - exiting" >> logs/overlap.log; exit 0; fi
  trap 'rmdir "$LOCK.d" 2>/dev/null' EXIT
fi

# ---- environment (cron starts with an almost empty one) ----
if [ -f .env ]; then set -a; . ./.env; set +a; fi
export PATH="${EXTRA_PATH:+$EXTRA_PATH:}$HOME/.local/bin:$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
RUN_TIMEOUT="${RUN_TIMEOUT:-4h}"
PROMPT="${PROSPECT_PROMPT:-/knowtific-redesign-plugin:prospect next}"

STAMP="$(date +%Y-%m-%d_%H%M)"
LOG="logs/${STAMP}.log"
if [ -t 1 ]; then exec > >(tee -a "$LOG") 2>&1; else exec >>"$LOG" 2>&1; fi

echo "== prospect run $STAMP in $REPO"
echo "   prompt: $PROMPT | timeout: $RUN_TIMEOUT | node: $(node --version 2>/dev/null || echo missing)"
for v in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID PSI_API_KEY; do
  if [ -n "${!v:-}" ]; then echo "   $v: set"; else echo "   $v: not set"; fi
done

# ---- sync ----
IS_GIT=0
if git rev-parse --git-dir >/dev/null 2>&1; then
  IS_GIT=1
  if [ -n "$(git remote)" ]; then git pull --ff-only --quiet || echo "!! git pull --ff-only failed - continuing with the local copy"; fi
fi

# ---- permissions: explicit allowlist, everything else is denied without a prompt ----
ALLOWED=(
  "Bash(node:*)" "Bash(npx:*)" "Bash(npm:*)" "Bash(git:*)"
  "Bash(mkdir:*)" "Bash(cp:*)" "Bash(mv:*)" "Bash(ls:*)" "Bash(cat:*)"
  "Bash(head:*)" "Bash(tail:*)" "Bash(wc:*)" "Bash(grep:*)" "Bash(sort:*)" "Bash(date:*)" "Bash(pwd)"
  "Bash(cd:*)" "Bash(echo:*)"
  "Read" "Write" "Edit" "Glob" "Grep" "WebSearch" "WebFetch"
  "Task" "Agent" "Skill" "TodoWrite"
)
if [ "${SKIP_PERMISSIONS:-0}" = "1" ]; then
  PERMS=(--dangerously-skip-permissions)
else
  PERMS=(--permission-mode dontAsk --allowedTools "${ALLOWED[@]}")
fi
# Allow rules match each command by its first word, so the model must keep commands simple.
RULES="Unattended cron run: nobody can answer questions or approve anything. Bash commands are allowed by their first word only (node, npx, npm, git, mkdir, cp, mv, ls, cat, head, tail, wc, grep, sort, date, pwd, cd, echo). Write each Bash command as one simple command with absolute or repo-relative paths: never set shell variables (X=... or export), never use \$(...) or backticks, and only chain allowed commands. If a command is denied, rewrite it in that form and try again - a denial is never a reason to stop the run."
EXTRA=()
# read access to the installed plugin (scripts, templates) without leaving the repo writable elsewhere
[ -d "$HOME/.claude/plugins" ] && EXTRA+=(--add-dir "$HOME/.claude/plugins")
[ -n "${MAX_BUDGET_USD:-}" ] && EXTRA+=(--max-budget-usd "$MAX_BUDGET_USD")
[ -n "${CLAUDE_MODEL:-}" ] && EXTRA+=(--model "$CLAUDE_MODEL")
if [ "${VERBOSE:-0}" = "1" ]; then EXTRA+=(--output-format stream-json --verbose); else EXTRA+=(--output-format text); fi

rm -f prospects/.last-run
START=$(date +%s)
# AskUserQuestion is removed outright, and no MCP servers load (no mail or chat connectors).
timeout --kill-after=5m "$RUN_TIMEOUT" "$CLAUDE_BIN" -p "$PROMPT" \
  "${PERMS[@]}" --disallowedTools AskUserQuestion --strict-mcp-config --append-system-prompt "$RULES" "${EXTRA[@]}"
RC=$?
echo "== claude exited with $RC after $(( ($(date +%s) - START) / 60 )) min$([ $RC -eq 124 ] && echo ' (timed out)')"

# ---- commit whatever the run produced, even a partial prospect ----
if [ $IS_GIT -eq 1 ]; then
  SLUG=""
  if [ -f prospects/.last-run ]; then SLUG="$(tr -d '[:space:]' < prospects/.last-run)"; fi
  git add -A
  if git diff --cached --quiet; then
    echo "== nothing changed, no commit"
  else
    git commit -q -m "prospect: ${SLUG:-run $STAMP}" && echo "== committed: prospect: ${SLUG:-run $STAMP}"
    if [ "${GIT_PUSH:-0}" = "1" ] && [ -n "$(git remote)" ]; then git push -q || echo "!! git push failed"; fi
  fi
fi
exit $RC
