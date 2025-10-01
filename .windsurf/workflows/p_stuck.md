---
title: prjct stuck
invocable_name: p:stuck
description: Get contextual help with problems using global prjct architecture
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` from config
3. Parse issue description from arguments
4. Read current task from `~/.prjct-cli/projects/{projectId}/core/now.md`
5. Read project context from `~/.prjct-cli/projects/{projectId}/core/context.md`
6. Read recent memory from `~/.prjct-cli/projects/{projectId}/memory/context.jsonl` (last 20)
7. Analyze repository structure from `~/.prjct-cli/projects/{projectId}/analysis/repo-summary.md`
8. Analyze issue in context:
   - Identify problem type (technical, conceptual, process)
   - Search for related recent actions
   - Check for similar past issues
9. Generate contextual suggestions
10. Offer to break down problem or create subtasks
11. Log help request to memory

# Response Format

```
🆘 Help Request: {issue description}

🔍 Context Analysis:
Current Focus: {current task}
Related Work: {recent related actions}
Project Type: {tech stack/framework}

💡 Suggestions:

1. {Primary suggestion with reasoning}
   - Why: {explanation}
   - Next: {specific action}

2. {Alternative approach}
   - Why: {explanation}
   - Next: {specific action}

3. {Fallback option}
   - Why: {explanation}
   - Next: {specific action}

🛠️  Tools & Resources:
- {relevant documentation}
- {related code examples}
- {helpful commands}

📋 Break It Down?
Want to split this into smaller tasks?
- /p:task {breakdown}
- Add to queue: /p:next

🤔 Still Stuck?
- Capture learnings: /p:idea
- Take a break and come back
- Pair with someone on this
```

# Problem Type Classification

**Technical Issues**:
- Code errors, bugs, performance
- Suggest: debugging steps, logging, testing
- Resources: documentation, stack traces

**Conceptual Issues**:
- Design decisions, architecture, approach
- Suggest: break down problem, research, prototypes
- Resources: patterns, examples, comparisons

**Process Issues**:
- Workflow, priorities, task management
- Suggest: task breakdown, reprioritization, scope adjustment
- Resources: project context, roadmap, ideas

**Environment Issues**:
- Setup, dependencies, configuration
- Suggest: verification steps, common fixes, clean rebuild
- Resources: setup docs, env checks

# Contextual Intelligence

Analyze:
- **Recent patterns**: Repeated issues in same area
- **Time of day**: Late-night coding fatigue factor
- **Task complexity**: Is current task too large?
- **Progress trend**: Long time without shipping

Suggest:
- **Pattern detected**: "3rd time with this module - might need refactoring?"
- **Fatigue factor**: "2 AM coding session - consider fresh perspective tomorrow?"
- **Complexity overload**: "This task seems large - break it down?"
- **Momentum loss**: "No ships this week - aim for smaller wins?"

# Global Architecture Notes

- **Context Sources**:
  - `~/.prjct-cli/projects/{id}/core/now.md` - Current work
  - `~/.prjct-cli/projects/{id}/core/context.md` - Project info
  - `~/.prjct-cli/projects/{id}/memory/context.jsonl` - Recent activity
  - `~/.prjct-cli/projects/{id}/analysis/repo-summary.md` - Technical context
- **Config Location**: `{project}/.prjct/prjct.config.json`
- **Memory Logging**: Help requests logged for pattern detection
- **Use Case**: Debugging, unblocking, learning, momentum recovery
