---
title: prjct ship
invocable_name: p:ship
description: Ship feature
---

# Steps

1. Get projectId + author from `.prjct/prjct.config.json`
2. Append to `~/.prjct-cli/projects/{id}/progress/shipped.md` + timestamp
3. Update `progress/metrics.md` (count, velocity)
4. Log to `memory/context.jsonl` with author
5. Response:
   ```
   🚀 {feature}
   Week: {n} | Total: {total}
   → /p:now
   ```
