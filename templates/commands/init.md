---
allowed-tools: [Read, Write, Bash, Glob]
description: "Initialize prjct project with global architecture"
---

# /p:init - Initialize Project

## Purpose
Initialize a new prjct project using global architecture with centralized data storage.

## Global Architecture
This command creates:
- **Global data directory**: `~/.prjct-cli/projects/{id}/` (shared across editors)
- **Local config file**: `.prjct/prjct.config.json` (links to global data)
- **Synchronized commands**: Available in Claude Code, Cursor, Windsurf

## Usage
```
/p:init
```

## Implementation

When this command is executed in Claude Code:

### 1. Generate Project ID
```bash
# Generate unique ID from project path hash
PROJECT_PATH="$(pwd)"
PROJECT_ID=$(echo -n "$PROJECT_PATH" | shasum -a 256 | cut -c1-12)
```

### 2. Create Global Directory Structure
```bash
# Create global data directory
mkdir -p ~/.prjct-cli/projects/$PROJECT_ID/{core,progress,planning,analysis,memory}
```

### 3. Create Local Configuration
```bash
# Create local config directory
mkdir -p .prjct

# Get author info from git
AUTHOR_NAME=$(git config user.name 2>/dev/null || echo "Unknown")
AUTHOR_EMAIL=$(git config user.email 2>/dev/null || echo "unknown@example.com")

# Create config file linking to global data
cat > .prjct/prjct.config.json << EOF
{
  "version": "0.3.0",
  "projectId": "$PROJECT_ID",
  "dataPath": "~/.prjct-cli/projects/$PROJECT_ID",
  "author": {
    "name": "$AUTHOR_NAME",
    "email": "$AUTHOR_EMAIL"
  },
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
```

### 4. Initialize Core Files (in global directory)

**~/.prjct-cli/projects/{id}/core/now.md**:
```markdown
# NOW: No current task

Start a new task with `/p:now [task description]`
```

**~/.prjct-cli/projects/{id}/core/next.md**:
```markdown
# NEXT - Priority Queue

Add tasks here that should be done after the current task.
```

**~/.prjct-cli/projects/{id}/core/context.md**:
```markdown
# Project Context

## Overview
[Auto-generated from `/p:analyze`]

## Current Focus
[Link to current task in now.md]

## Key Information
- **Repository**: [auto-detected]
- **Tech Stack**: [auto-detected]
- **Architecture**: [auto-detected]
```

### 5. Initialize Progress Tracking

**~/.prjct-cli/projects/{id}/progress/shipped.md**:
```markdown
# SHIPPED - Completed Features

## Week [CURRENT_WEEK], [YEAR]

_Ship features with `/p:ship <feature>`_
```

**~/.prjct-cli/projects/{id}/progress/metrics.md**:
```markdown
# Progress Metrics

## This Week
- **Shipped**: 0 features
- **Active**: 0 tasks
- **Planned**: 0 items

## Historical
[Auto-updated by commands]
```

### 6. Initialize Planning Layer

**~/.prjct-cli/projects/{id}/planning/ideas.md**:
```markdown
# IDEAS - Brain Dump

Capture ideas quickly with `/p:idea <text>`

## Backlog
- [ ] [Ideas will appear here]

## Someday/Maybe
- [ ] [Future ideas]
```

**~/.prjct-cli/projects/{id}/planning/roadmap.md**:
```markdown
# Roadmap

## Current Sprint
[Active items from next.md]

## Upcoming
[Planned features and improvements]

## Long-term Vision
[Strategic goals and objectives]
```

### 7. Initialize Memory Layer

Create empty JSONL files for historical tracking:
- **memory/context.jsonl**: Activity log with timestamps
- **memory/decisions.jsonl**: Decision history (not used yet)

### 8. Run Project Analysis

Execute `/p:analyze` to understand the project:

```javascript
// This should execute the analyze command internally
// The AI will:
// 1. Scan project structure
// 2. Detect stack and frameworks
// 3. Check git status
// 4. Determine which agents are needed
// 5. Save analysis to .prjct/analysis/repo-summary.md
```

### 9. Generate AI Agents

Based on the analysis, generate specialized AI agents:

```javascript
const agentGenerator = require('../core/agent-generator')
const analysis = await readAnalysisFile('.prjct/analysis/repo-summary.md')

// Generate all required agents
const generatedAgents = await agentGenerator.generateAll(analysis)

// Agents are created in ~/.claude/agents/
// They are immediately available in Claude Code and Claude Desktop
```

**Generated Agents**:
- **Base** (always): PM, UX, FE, BE, QA, Scribe (6 agents)
- **Conditional** (based on project):
  - Security (if web app or has auth)
  - DevOps (if Docker/CI/CD detected)
  - Mobile (if React Native/Flutter detected)
  - Data (if ML/data science detected)

### 10. Log Initialization

Add initialization record to memory:
```jsonl
{"timestamp":"2025-10-01T09:00:00Z","action":"init","author":"Name","projectPath":"/path/to/project","projectId":"abc123def456","agents":["pm","ux","fe","be","qa","scribe","security"]}
```

### 11. Success Message (Conversational Onboarding)

```
✅ Your project is ready!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Project Analysis Complete

Project: [PROJECT_NAME]
Type: [PROJECT_TYPE]
Stack: [DETECTED_STACK]

🤖 AI Agents Generated ([COUNT] specialists)

✅ PM - Project coordination
✅ UX - Design & user experience
✅ FE - Frontend development
✅ BE - Backend development
✅ QA - Testing & quality
✅ Scribe - Documentation
[+ conditional agents if detected]

These agents are now available in Claude and will provide
specialized expertise for your project tasks.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 Let me show you around...

You don't need to memorize commands.
Just talk to me naturally!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 To start working:

   Say: "I want to start building the login page"
   Or:  /p:now "build login page"

   → I'll track your focus and time

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ When you finish something:

   Say: "I'm done" or "finished that"
   Or:  /p:done

   → I'll celebrate and suggest what's next

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 To ship a feature:

   Say: "ship the authentication system"
   Or:  /p:ship "authentication system"

   → I'll track your velocity and wins

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Have ideas? Just say:

   "I have an idea about dark mode"
   "What should I work on next?"
   "Show me my progress"
   "I'm stuck on async state"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🆘 Need help anytime?

   Type: /p:help

   → I'll show you all options in plain language

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ready to start? Tell me what you want to build first!

(Or type /p:help to see all options)
```

## Error Handling

- **If .prjct/ exists**: Warn that project may already be initialized
- **If git not available**: Use generic author info
- **If global directory creation fails**: Show error and suggest manual creation
- **If config write fails**: Check permissions on .prjct/ directory

## Notes

- Project ID is deterministic based on project path
- Same project path always gets same ID
- Global data enables cross-editor synchronization
- Local config is minimal (just links to global data)
- Works for solo developers and small teams (2-5 people)
