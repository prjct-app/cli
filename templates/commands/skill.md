---
allowed-tools: [Read, Glob]
description: 'List, search, and invoke skills'
timestamp-rule: 'None'
architecture: 'Skill discovery and execution'
---

# /p:skill - Skill Management

List, search, and invoke reusable skills.

## Usage

```
/p:skill                    # List all skills
/p:skill list               # List all skills
/p:skill search <query>     # Search skills
/p:skill show <id>          # Show skill details
/p:skill invoke <id>        # Invoke a skill
```

## Flow

### List Skills (`/p:skill` or `/p:skill list`)

1. Load skills from all sources:
   - Project: `.prjct/skills/*.md`
   - Global: `~/.prjct-cli/skills/*.md`
   - Built-in: `templates/skills/*.md`

2. Output grouped by source:

```
## Available Skills

### Project Skills
- **custom-deploy** - Deploy to staging server

### Global Skills
- **my-template** - Personal code template

### Built-in Skills
- **code-review** - Review code for quality
- **refactor** - Refactor code structure
- **debug** - Systematic debugging
```

### Search Skills (`/p:skill search <query>`)

1. Search skill names, descriptions, and tags
2. Sort by relevance
3. Output matches

### Show Skill (`/p:skill show <id>`)

1. Load skill by ID
2. Display metadata and content

```
## Skill: code-review

**Description:** Review code for quality
**Source:** builtin
**Tags:** review, quality, security
**Agent:** general

### Content
[Full skill prompt content]
```

### Invoke Skill (`/p:skill invoke <id>`)

1. Load skill by ID
2. Return skill content for execution
3. The skill content becomes the prompt

## Skill File Format

Skills are markdown files with frontmatter:

```markdown
---
name: My Skill
description: What the skill does
agent: general
tags: [tag1, tag2]
version: 1.0.0
---

# Skill Content

The actual prompt/instructions...
```

## Creating Custom Skills

### Project Skill
Create `.prjct/skills/my-skill.md`

### Global Skill
Create `~/.prjct-cli/skills/my-skill.md`

## Output Format

```
## Skills ({count} total)

### {source}
- **{name}** ({id}): {description}
```
