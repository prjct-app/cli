# Skill Integration Guide

How prjct agents integrate with Claude Code skills from claude-plugins.dev.

---

## Overview

prjct agents are domain specialists that work alongside Claude Code skills. Each agent can have one or more linked skills that provide additional capabilities.

**Skills are discovered AGENTICALLY** - Claude searches claude-plugins.dev to find the best matching skill for each agent.

```
Agent (prjct)          →  Skill (searched dynamically)
├── frontend.md        →  Search "frontend-design" → best match
├── uxui.md            →  Search "ux-designer" → best match
├── backend.md         →  Search "{ecosystem} backend" → best match
├── testing.md         →  Search "testing automation" → best match
├── devops.md          →  Search "devops ci cd" → best match
├── prjct-planner.md   →  Search "architecture planning" → best match
└── prjct-shipper.md   →  Search "code review" → best match
```

---

## How Skills Are Installed (AGENTIC)

### During `p. sync`

**Step 7.5 is AGENTIC - Claude searches and installs skills dynamically:**

1. **Check existing skills**: `ls ~/.claude/skills/*.md`
2. **For each generated agent**:
   - Read search hints from `templates/config/skill-mappings.json`
   - Search `https://claude-plugins.dev/skills?q={searchTerm}`
   - Analyze results: prefer @anthropics, high downloads, recent updates
   - Get skill content from GitHub source
   - Write to `~/.claude/skills/{name}.md`
3. **Save mapping** to `{globalPath}/config/skills.json`
4. **Update agent frontmatter** with `skills: [foundSkillName]`

### Search Endpoint

```
https://claude-plugins.dev/skills?q={search_term}
```

### Selection Criteria

When choosing a skill from search results:
1. **Match agent domain** - skill must relate to agent's expertise
2. **Prefer @anthropics** - official skills are most reliable
3. **High download count** - community-validated
4. **Recent updates** - actively maintained
5. **Good documentation** - usable immediately

### Fallback: Create Custom Skill

If no suitable skill found on marketplace:

```markdown
---
name: {agent}-custom-skill
description: Custom skill for {agent} domain
---

# {Agent} Custom Skill

## Expertise
{Based on agent's domain}

## Patterns
{Common patterns for this domain}
```

### Manual Installation

```bash
# Skills are markdown files in ~/.claude/skills/
mkdir -p ~/.claude/skills

# Download a skill manually
curl -o ~/.claude/skills/frontend-design.md \
  https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/frontend-design/skills/frontend-design.md

# List installed skills
ls ~/.claude/skills/

# Use /skills command to see available skills
/skills
```

---

## How Skills Are Used

### During `p. task`

**Phase 2: Exploration**
```
IF task involves UI components:
  Invoke Skill("frontend-design")

IF task involves backend/API:
  Invoke Skill(ecosystemSkill)  # javascript-typescript or python-development
```

**Phase 4: Design**
```
FOR EACH relevant agent:
  READ agent frontmatter → get skills array
  FOR EACH skill:
    Invoke Skill(skill) for domain expertise
```

### During `p. ship`

```
BEFORE shipping:
  Invoke Skill("code-review") for automated review
  Apply quality gates from skill output
```

---

## Agent Frontmatter Format

Agents declare their linked skills in YAML frontmatter:

```yaml
---
name: frontend
description: "Frontend specialist. Use PROACTIVELY for UI work."
tools: Read, Write, Glob, Grep
model: sonnet
skills: [frontend-design]
---
```

The `skills` array lists skill names (not full identifiers).

---

## Skill Invocation Patterns

### 1. Automatic (Recommended)

Agent frontmatter includes `skills: [name]`
→ Task workflow auto-invokes when agent is loaded

### 2. Manual

User directly invokes:
```
/frontend-design
```
→ Skill executes with current context

### 3. Conditional

Based on task classification:
```
IF taskType == "feature" AND hasUI:
  Invoke frontend-design

IF taskType == "bug" AND isBackend:
  Invoke javascript-typescript (or python-development)

IF taskType == "refactor":
  Invoke code-review first
```

---

## Skill Mapping Configuration

Location: `templates/config/skill-mappings.json`

```json
{
  "mappings": {
    "frontend": {
      "skill": "@anthropics/claude-code-plugins/frontend-design",
      "skillName": "frontend-design",
      "autoInstall": true
    }
  }
}
```

**Fields:**
- `skill`: Full package identifier for installation
- `skillName`: Short name for invocation (/skillName)
- `autoInstall`: Whether to install during sync
- `ecosystems`: For backend, maps language to specific skill
- `subSkill`: For multi-skill packages like developer-kit

---

## Project Skills Configuration

Location: `~/.prjct-cli/projects/{projectId}/config/skills.json`

Generated during sync:

```json
{
  "projectId": "uuid",
  "ecosystem": "javascript",
  "installedAt": "2026-01-08T...",
  "skills": [
    {
      "name": "frontend-design",
      "package": "@anthropics/claude-code-plugins/frontend-design",
      "linkedAgents": ["frontend", "uxui"]
    },
    {
      "name": "javascript-typescript",
      "package": "@wshobson/claude-code-workflows/javascript-typescript",
      "linkedAgents": ["backend"]
    }
  ],
  "agentSkillMap": {
    "frontend": "frontend-design",
    "uxui": "frontend-design",
    "backend": "javascript-typescript",
    "prjct-planner": "feature-dev",
    "prjct-shipper": "code-review"
  }
}
```

---

## Key Skills Reference

### frontend-design (@anthropics)
- Production-grade UI components
- Anti-AI-slop patterns (no Inter + purple gradients)
- Distinctive typography (Clash Display, Satoshi, Geist)
- 60-30-10 color framework
- High-impact animations

### javascript-typescript (@wshobson)
- ES6+ and TypeScript patterns
- Node.js backend patterns
- React/Vue/Svelte best practices
- Testing patterns

### python-development (@wshobson)
- Python 3.12+ features
- Django/FastAPI patterns
- Async Python patterns
- Type hints and protocols

### feature-dev (@anthropics)
- Feature development workflow
- Codebase exploration
- Architecture design
- Implementation planning

### code-review (@anthropics)
- Automated PR review
- Confidence scoring
- Security analysis
- Best practices validation

### developer-kit (@claudebase)
- 24 skills + 14 agents + 21 commands
- Testing automation
- DevOps pipelines
- Security scanning

---

## Troubleshooting

### Skill Not Installing

```bash
# Check if Claude Code is installed
which claude

# Manual install with verbose output
npx claude-plugins install @anthropics/claude-code-plugins/frontend-design --verbose

# Check installed plugins
claude /plugins list
```

### Skill Not Invoking

1. Check agent frontmatter has `skills: [skillName]`
2. Check `{globalPath}/config/skills.json` exists
3. Verify skill is in installed list: `claude /plugins list`
4. Try manual invocation: `/frontend-design`

### Wrong Skill for Ecosystem

Backend agents detect ecosystem from `analysis/repo-analysis.json`.
If wrong, re-run `p. sync` to re-analyze.

---

## Best Practices

1. **Always run `p. sync` after cloning** - Installs correct skills
2. **Let agents invoke skills** - Don't manually invoke during tasks
3. **frontend-design is critical** - Ensures distinctive UI (UX > UI)
4. **code-review before ship** - Catches issues early
5. **Update skills periodically** - `npx claude-plugins update`
