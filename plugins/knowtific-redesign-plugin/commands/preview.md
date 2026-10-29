---
description: Phase 7 - build and serve the live comparison viewer (layout x brand x device), optionally deploy it for the client
argument-hint: [deploy]
---

Use the `site-redesign` skill and run **Phase 7 - Live preview**. Argument: $ARGUMENTS
1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-preview.mjs" redesign` and fix any warnings.
2. Serve it in the background: `node "${CLAUDE_PLUGIN_ROOT}/scripts/serve.mjs" redesign/preview --port 4321`
   and give the user the URL.
3. If the argument is `deploy`, ask which host (Vercel / Netlify / Cloudflare Pages), confirm,
   and deploy `redesign/preview/`.
4. If `redesign/decision.json` exists, read it and write `04-plan/decision-brief.md`.
