---
title: prjct stuck
invocable_name: p:stuck
description: Get unstuck
---

# Steps

1. Get projectId from `.prjct/prjct.config.json`
2. Detect type: bug/design/perf/feature
3. Read context from:
   - `~/.prjct-cli/projects/{id}/analysis/repo-summary.md`
   - `~/.prjct-cli/projects/{id}/memory/context.jsonl`
4. Log to `memory/context.jsonl`
5. Response by type:
   - **Bug**: `🔍 1. Check logs 2. Isolate 3. Search error`
   - **Design**: `🎨 1. Define clearly 2. Start simple 3. Ship MVP`
   - **Perf**: `⚡ 1. Profile 2. Fix slowest 3. Cache`
   - **Default**: `💡 1. Break down 2. Start smallest 3. Ship`
6. Suggest breakdown:
   ```
   🧩 Break down:
   1. {task} (15m)
   → /p:now "{first}"
   ```
