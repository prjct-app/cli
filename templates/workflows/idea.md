---
title: prjct idea
invocable_name: p:idea
description: Quick capture
---

# Steps

1. Get projectId + author from `.prjct/prjct.config.json`
2. Append to `~/.prjct-cli/projects/{id}/planning/ideas.md` + timestamp
3. If has action verbs → add to `core/next.md`
4. Log to `memory/context.jsonl` with author
5. Response:
   ```
   💡 {idea}
   → Added to queue
   ```
   Or:
   ```
   💡 {idea}
   → Saved to backlog
   ```
