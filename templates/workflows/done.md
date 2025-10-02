---
title: prjct done
invocable_name: p:done
description: Complete task
---

# Steps

1. Get projectId + author from `.prjct/prjct.config.json`
2. Read + calculate duration from `~/.prjct-cli/projects/{id}/core/now.md`
3. Clear `core/now.md`
4. Update `progress/metrics.md`
5. Log to `memory/context.jsonl` with author + duration
6. Check `core/next.md` for next task
7. Response:
   ```
   ✅ {task} ({duration})
   Next: {task}
   → /p:now {next}
   ```
