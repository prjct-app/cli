---
allowed-tools: [Read, Glob]
description: 'Determine which quality checklists to apply - Claude decides'
---

# Checklist Routing Instructions

## Objective

Determine which quality checklists are relevant for a task by analyzing the ACTUAL task and its scope.

## Step 1: Understand the Task

Read the task description and identify:

- What type of work is being done? (new feature, bug fix, refactor, infra, docs)
- What domains are affected? (code, UI, API, database, deployment)
- What is the scope? (small fix, major feature, architectural change)

## Step 2: Consider Task Domains

Each task can touch multiple domains. Consider:

| Domain | Signals |
|--------|---------|
| Code Quality | Writing/modifying any code |
| Architecture | New components, services, or major refactors |
| UX/UI | User-facing changes, CLI output, visual elements |
| Infrastructure | Deployment, containers, CI/CD, cloud resources |
| Security | Auth, user data, external inputs, secrets |
| Testing | New functionality, bug fixes, critical paths |
| Documentation | Public APIs, complex features, breaking changes |
| Performance | Data processing, loops, network calls, rendering |
| Accessibility | User interfaces (web, mobile, CLI) |
| Data | Database operations, caching, data transformations |

## Step 3: Match Task to Checklists

Based on your analysis, select relevant checklists:

**DO NOT assume:**
- Every task needs all checklists
- "Frontend" = only UX checklist
- "Backend" = only Code Quality checklist

**DO analyze:**
- What the task actually touches
- What quality dimensions matter for this specific work
- What could go wrong if not checked

## Available Checklists

Located in `templates/checklists/`:

| Checklist | When to Apply |
|-----------|---------------|
| `code-quality.md` | Any code changes (any language) |
| `architecture.md` | New modules, services, significant structural changes |
| `ux-ui.md` | User-facing interfaces (web, mobile, CLI, API DX) |
| `infrastructure.md` | Deployment, containers, CI/CD, cloud resources |
| `security.md` | ALWAYS for: auth, user input, external APIs, secrets |
| `testing.md` | New features, bug fixes, refactors |
| `documentation.md` | Public APIs, complex features, configuration changes |
| `performance.md` | Data-intensive operations, critical paths |
| `accessibility.md` | Any user interface work |
| `data.md` | Database, caching, data transformations |

## Decision Process

1. Read task description
2. Identify primary work domain
3. List secondary domains affected
4. Select 2-4 most relevant checklists
5. Consider Security (almost always relevant)

## Output

Return selected checklists with reasoning:

```json
{
  "checklists": ["code-quality", "security", "testing"],
  "reasoning": "Task involves new API endpoint (code), handles user input (security), and adds business logic (testing)",
  "priority_items": ["Input validation", "Error handling", "Happy path tests"],
  "skipped": {
    "accessibility": "No user interface changes",
    "infrastructure": "No deployment changes"
  }
}
```

## Rules

- **Task-driven** - Focus on what the specific task needs
- **Less is more** - 2-4 focused checklists beat 10 unfocused
- **Security is special** - Default to including unless clearly irrelevant
- **Explain your reasoning** - Don't just pick, justify selections AND skips
- **Context matters** - Small typo fix ≠ major refactor in checklist needs
