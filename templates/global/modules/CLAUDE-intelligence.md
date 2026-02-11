## INTELLIGENT BEHAVIOR (For SMART commands only)

### When Starting Tasks (`p. task`)
1. **Analyze** - Understand what user wants to achieve
2. **Classify** - Determine type: feature, bug, improvement, refactor, chore
3. **Explore** - Find similar code, patterns, affected files
4. **Ask** - Clarify ambiguities (use AskUserQuestion)
5. **Design** - Propose 2-3 approaches, get approval
6. **Break down** - Create actionable subtasks
7. **Track** - Update state via `prjct` CLI

### When Completing Tasks (`p. done`)
1. Check if there are more subtasks
2. If yes, advance to next subtask
3. If no, task is complete
4. Update storage, generate context

### When Shipping (`p. ship`)
1. Run tests (if configured)
2. Create PR (if on feature branch)
3. Bump version
4. Update CHANGELOG
5. Create git tag

### Key Intelligence Rules
- **Read before write** - Always read existing files before modifying
- **Explore before coding** - Use Task(Explore) to understand codebase
- **Ask when uncertain** - Use AskUserQuestion to clarify
- **Let CLI handle storage** - Use `prjct` CLI for all state changes

---

## ARCHITECTURE: Write-Through Pattern

```
User Action → Storage (SQLite) → Context (MD)
```

| Layer | Path | Purpose |
|-------|------|---------|
| **Storage** | `prjct.db` | Source of truth (SQLite) |
| **Context** | `context/*.md` | Claude-readable summaries |
| **Agents** | `agents/*.md` | Domain specialists |
| **Sync** | `sync/pending.json` | Backend sync queue |

### File Structure
```
~/.prjct-cli/projects/{projectId}/
├── prjct.db            # SQLite database (SOURCE OF TRUTH)
├── context/
│   ├── now.md          # Current task (generated)
│   └── next.md         # Queue (generated)
├── config/
│   └── skills.json     # Agent-to-skill mappings
├── agents/             # Domain specialists (auto-generated)
└── sync/
    └── pending.json    # Events for backend
```

> **All storage reads/writes go through `prjct` CLI commands, which use SQLite internally. Never read or write JSON storage files directly.**

---

## LOADING DOMAIN AGENTS

When working on tasks, load relevant agents from `{globalPath}/agents/`:
- `frontend.md` - Frontend patterns, components
- `backend.md` - Backend patterns, APIs
- `database.md` - Database patterns, queries
- `uxui.md` - UX/UI guidelines
- `testing.md` - Testing patterns
- `devops.md` - CI/CD, containers

These agents contain project-specific patterns. **USE THEM**.

---

## SKILL INTEGRATION

Agents are linked to Claude Code skills from claude-plugins.dev.

### How Skills Work

1. **During `p. sync`**: Search claude-plugins.dev, install best matches
2. **During `p. task`**: Skills are auto-invoked for domain expertise
3. **Agent frontmatter** has `skills: [discovered-skill-name]` field

### Skill Location

Skills are markdown files in `~/.claude/skills/`
