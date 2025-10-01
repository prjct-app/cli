---
title: prjct idea
invocable_name: p:idea
description: Capture ideas quickly to backlog using global prjct architecture
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` and `author` from config
3. Validate idea text provided
4. Append idea to `~/.prjct-cli/projects/{projectId}/planning/ideas.md` with:
   - Idea text
   - Timestamp
   - Author (for team collaboration)
5. Log capture to `~/.prjct-cli/projects/{projectId}/memory/context.jsonl`
6. Analyze if idea is immediately actionable
7. If actionable, suggest adding to priority queue
8. Display confirmation without interrupting focus

# Response Format

```
💡 Idea captured: {idea text}

Saved to backlog at {timestamp}

{if actionable}
This looks actionable! Want to prioritize it?
- Add to queue: Update /p:next
- Start now: /p:now {idea}
{endif}

Keep your focus on current task!
```

# Actionability Detection

Idea is actionable if it:
- Contains specific feature/task language
- Has clear scope/boundaries
- Is technically feasible
- Doesn't require extensive planning

# Global Architecture Notes

- **Data Location**: `~/.prjct-cli/projects/{id}/planning/ideas.md`
- **Memory Location**: `~/.prjct-cli/projects/{id}/memory/context.jsonl`
- **Config Location**: `{project}/.prjct/prjct.config.json`
- **Author Tracking**: Ideas logged with author for team brainstorming
- **Non-Disruptive**: Fast capture without context switching
