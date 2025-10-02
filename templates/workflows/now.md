---
title: prjct now
invocable_name: p:now
description: Set/show current focus
---

# Steps

**Show**: Read config → get projectId → read `~/.prjct-cli/projects/{id}/core/now.md`

**Set**:
1. Get projectId + author from `.prjct/prjct.config.json`
2. Write task + timestamp to `~/.prjct-cli/projects/{id}/core/now.md`
3. Log to `memory/context.jsonl` with author
4. Response:
   ```
   🎯 {task}
   → /p:done when complete
   ```
