---
allowed-tools: [Read, Glob, Bash]
description: 'List, search, and invoke skills'
timestamp-rule: 'None'
architecture: 'Skill discovery, installation, and execution'
---

# /p:skill - Skill Management

List, search, install, and invoke reusable skills.

## Usage

```
/p:skill                        # List all skills
/p:skill list                   # List all skills
/p:skill search <query>         # Search skills
/p:skill show <id>              # Show skill details
/p:skill invoke <id>            # Invoke a skill
/p:skill add <source>           # Install skill from remote source
/p:skill remove <name>          # Remove an installed skill
/p:skill init <name>            # Scaffold a new skill
/p:skill check                  # Check for available updates
```

## Flow

### List Skills (`/p:skill` or `/p:skill list`)

1. Load skills from all sources:
   - Project: `.prjct/skills/*.md` and `.prjct/skills/*/SKILL.md`
   - Provider: `~/.claude/skills/*/SKILL.md` and `~/.claude/skills/*.md`
   - Global: `~/.prjct-cli/skills/*.md` and `~/.prjct-cli/skills/*/SKILL.md`
   - Built-in: `templates/skills/*.md`

2. Check lock file at `~/.prjct-cli/skills/.skill-lock.json` for source info

3. Output grouped by source:

```
## Available Skills

### Project Skills
- **custom-deploy** - Deploy to staging server

### Global Skills (Provider)
- **frontend-design** - Create production-grade UIs [github: vercel-labs/skills]
- **my-template** - Personal code template

### Built-in Skills
- **code-review** - Review code for quality
- **refactor** - Refactor code structure
```

### Search Skills (`/p:skill search <query>`)

1. Search skill names, descriptions, and tags
2. Sort by relevance
3. Output matches

### Show Skill (`/p:skill show <id>`)

1. Load skill by ID
2. Display metadata and content
3. If remotely installed, show source tracking info

```
## Skill: frontend-design

**Description:** Create production-grade frontend interfaces
**Source:** global (github: vercel-labs/skills)
**Tags:** frontend, design, ui
**Version:** 1.0.0
**Installed:** 2026-01-28T12:00:00.000Z
**SHA:** abc123

### Content
[Full skill prompt content]
```

### Invoke Skill (`/p:skill invoke <id>`)

1. Load skill by ID
2. Return skill content for execution
3. The skill content becomes the prompt

### Add Skill (`/p:skill add <source>`)

Install skills from remote sources.

**Supported source formats:**
- `owner/repo` — Clone GitHub repo, install all discovered skills
- `owner/repo@skill-name` — Install specific skill from GitHub repo
- `./local-path` — Install from local directory

**Install flow:**
1. Parse source string
2. For GitHub: `git clone --depth 1` to temp dir (60s timeout)
3. Discover SKILL.md files (scans `*/SKILL.md` and `skills/*/SKILL.md`)
4. Copy to `~/.claude/skills/{name}/SKILL.md` (ecosystem standard format)
5. Add `_prjct` metadata block to frontmatter (sourceUrl, sha, installedAt)
6. Update lock file at `~/.prjct-cli/skills/.skill-lock.json`
7. Clean up temp dir

**Example:**
```
p. skill add vercel-labs/skills
p. skill add my-org/custom-skills@api-designer
p. skill add ./my-local-skill
```

**Output:**
```
✅ Installed 3 skills from vercel-labs/skills

- frontend-design → ~/.claude/skills/frontend-design/SKILL.md
- find-skills → ~/.claude/skills/find-skills/SKILL.md
- code-review → ~/.claude/skills/code-review/SKILL.md

Lock file updated: ~/.prjct-cli/skills/.skill-lock.json
```

### Remove Skill (`/p:skill remove <name>`)

1. Remove skill directory from `~/.claude/skills/{name}/`
2. Also remove flat file if it exists (`~/.claude/skills/{name}.md`)
3. Remove entry from lock file
4. Confirm removal

**Output:**
```
✅ Removed skill: frontend-design

Deleted: ~/.claude/skills/frontend-design/
Lock file updated.
```

### Init Skill (`/p:skill init <name>`)

Scaffold a new skill in the project.

1. Create `.prjct/skills/{name}/SKILL.md` with template frontmatter
2. Open for editing

**Template:**
```markdown
---
name: {name}
description: TODO - describe what this skill does
agent: general
tags: []
version: 1.0.0
author: {detected-author}
---

# {Name} Skill

## Purpose

Describe what this skill helps with.

## Instructions

Step-by-step instructions for the AI agent...
```

### Check Updates (`/p:skill check`)

Compare lock file SHAs with remote repositories to detect available updates.

1. Read lock file entries
2. For each GitHub-sourced skill, run `git ls-remote` to get latest SHA
3. Compare with stored SHA
4. Report skills with available updates (no auto-update)

**Output:**
```
## Skill Update Check

- **frontend-design** (vercel-labs/skills) — Update available
  Current: abc123 → Latest: def456
- **code-review** (vercel-labs/skills) — Up to date
- **my-local-skill** (local) — Skipped (local source)

1 update available. Run `p. skill add <source>` to update.
```

## Skill File Format

Skills are markdown files with frontmatter. Two formats are supported:

### Subdirectory Format (Ecosystem Standard)
```
~/.claude/skills/my-skill/SKILL.md
```

### Flat Format (Legacy)
```
~/.claude/skills/my-skill.md
```

### Frontmatter Schema

```markdown
---
name: My Skill
description: What the skill does
agent: general
tags: [tag1, tag2]
version: 1.0.0
author: Author Name
category: development
_prjct:
  sourceUrl: https://github.com/owner/repo
  sourceType: github
  installedAt: 2026-01-28T12:00:00.000Z
  sha: abc123
---

# Skill Content

The actual prompt/instructions...
```

## Creating Custom Skills

### Project Skill (repo-specific)
Create `.prjct/skills/my-skill/SKILL.md` or `.prjct/skills/my-skill.md`

### Global Skill (all projects)
Create `~/.claude/skills/my-skill/SKILL.md` or `~/.prjct-cli/skills/my-skill.md`

## Lock File

Installed skills are tracked in `~/.prjct-cli/skills/.skill-lock.json`:

```json
{
  "version": 1,
  "generatedAt": "2026-01-28T...",
  "skills": {
    "frontend-design": {
      "name": "frontend-design",
      "source": { "type": "github", "url": "vercel-labs/skills", "sha": "abc123" },
      "installedAt": "2026-01-28T...",
      "filePath": "~/.claude/skills/frontend-design/SKILL.md"
    }
  }
}
```

## Output Format

```
## Skills ({count} total)

### {source}
- **{name}** ({id}): {description} [{sourceInfo}]
```
