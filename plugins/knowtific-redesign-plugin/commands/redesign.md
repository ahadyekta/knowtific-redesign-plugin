---
description: Run (or resume) the full redesign engagement for a client website - discovery, audit, reports, plan, brand directions, page variations and live preview
argument-hint: <site-url> [client name]
---

Use the `site-redesign` skill to run the full redesign engagement for: $ARGUMENTS

1. If `redesign/state.json` exists, read it and resume from the first phase not marked `done`
   (tell the user where you're resuming). Otherwise create `redesign/` and `state.json`.
2. If no URL was given and none is in state, ask for it.
3. Create a task list with one item per phase (Discovery, Audit, Reports, Plan, Brand,
   Variations, Preview) and work through them in order, stopping at each gate the skill defines.
