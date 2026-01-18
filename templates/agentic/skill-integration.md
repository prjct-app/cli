# Skill Integration

Agents integrate with Claude Code skills from claude-plugins.dev.

## Agent → Skill Mapping

| Agent | Skill |
|-------|-------|
| frontend.md | frontend-design |
| uxui.md | frontend-design |
| backend.md | javascript-typescript |
| testing.md | developer-kit |
| devops.md | developer-kit |
| prjct-planner.md | feature-dev |
| prjct-shipper.md | code-review |

## Installation (during `p. sync`)

1. Check existing: `ls ~/.claude/skills/*.md`
2. Search: `https://claude-plugins.dev/skills?q={term}`
3. Prefer: @anthropics, high downloads
4. Write to: `~/.claude/skills/{name}.md`
5. Save mapping: `{globalPath}/config/skills.json`

## Agent Frontmatter

```yaml
---
name: frontend
description: "Frontend specialist. Use PROACTIVELY."
tools: Read, Write, Glob, Grep
skills: [frontend-design]
---
```

## Usage

**During `p. task`**:
- Load agent → invoke linked skills

**During `p. ship`**:
- Invoke code-review skill

## Key Skills

| Skill | Purpose |
|-------|---------|
| frontend-design | UI components, anti-AI-slop |
| javascript-typescript | Node.js, React patterns |
| python-development | Django, FastAPI patterns |
| feature-dev | Architecture, planning |
| code-review | PR review, security |
| developer-kit | Testing, DevOps |

## Troubleshooting

- Skill not invoking? Check agent `skills:` frontmatter
- Wrong skill? Re-run `p. sync`
- Manual invoke: `/frontend-design`
