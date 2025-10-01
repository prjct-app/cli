# AGENTS.md - OpenAI Codex Configuration

This file provides guidance to OpenAI Codex and other AI assistants when working with this repository.

## prjct Project Management Commands

This project uses **prjct-cli** for AI-integrated project management. All commands operate on global data stored in `~/.prjct-cli/projects/{project-id}/` while keeping a minimal configuration file in the project at `.prjct/prjct.config.json`.

### Architecture Overview

**Global Structure** (in `~/.prjct-cli/projects/{id}/`):
```
~/.prjct-cli/projects/{id}/
├── core/           # Current focus and priorities
│   ├── now.md      # Single current task
│   ├── next.md     # Priority queue
│   └── context.md  # Project context
├── progress/       # Completed work
│   ├── shipped.md  # Shipped features
│   └── metrics.md  # Progress tracking
├── planning/       # Future planning
│   ├── ideas.md    # Brainstorm backlog
│   └── roadmap.md  # Strategic planning
├── analysis/       # Technical analysis
│   └── repo-summary.md
└── memory/         # Decision history
    └── context.jsonl
```

**Local Config** (in project `.prjct/`):
```json
{
  "version": "0.2.1",
  "projectId": "unique-hash-id",
  "dataPath": "~/.prjct-cli/projects/{id}",
  "author": { "name": "...", "email": "...", "github": "..." }
}
```

---

## Commands Reference

### /p:init
**Initialize prjct in current project**

Creates:
- Global directory structure in `~/.prjct-cli/projects/{id}/`
- Local config at `.prjct/prjct.config.json`
- Detects author from GitHub CLI or git config
- Installs commands in all detected AI editors

**Usage**: `/p:init`

**Implementation**:
1. Generate project ID from path hash
2. Create global directory structure with all layers
3. Create local `.prjct/prjct.config.json`
4. Detect and store author information
5. Install commands to detected editors

---

### /p:now [task]
**Set or show current focus task**

**Without arguments**: Display current task from `~/.prjct-cli/projects/{id}/core/now.md`

**With task**: Update current focus
- Clear existing task
- Write new task to `~/.prjct-cli/projects/{id}/core/now.md`
- Log action to memory with timestamp and author
- Display confirmation with suggested next actions

**Usage**:
- `/p:now` - Show current task
- `/p:now Implement JWT authentication` - Set new task

**Implementation**:
1. Read `.prjct/prjct.config.json` for project ID
2. Construct global path: `~/.prjct-cli/projects/{id}/core/now.md`
3. Read/write file atomically
4. Log to `~/.prjct-cli/projects/{id}/memory/context.jsonl`

---

### /p:done
**Complete current task and clear focus**

Marks the current task as complete, archives it, clears focus, and suggests next actions from the priority queue.

**Usage**: `/p:done`

**Implementation**:
1. Read current task from `~/.prjct-cli/projects/{id}/core/now.md`
2. Append task to `~/.prjct-cli/projects/{id}/progress/shipped.md`
3. Clear `now.md`
4. Read `~/.prjct-cli/projects/{id}/core/next.md` and suggest top priority
5. Log completion to memory with author and timestamp

**Response Format**:
```
✅ Task completed: {task description}

📊 Progress Update:
- This week: X features shipped
- Total: Y features shipped

🎯 Suggested Next Action:
{top priority from next.md}

Ready to tackle it? Use /p:now to start!
```

---

### /p:ship <feature>
**Ship and celebrate a completed feature**

Records a shipped feature with celebration, updates metrics, and maintains momentum.

**Usage**: `/p:ship User authentication system`

**Implementation**:
1. Add feature to `~/.prjct-cli/projects/{id}/progress/shipped.md` with timestamp
2. Update metrics in `~/.prjct-cli/projects/{id}/progress/metrics.md`
3. Log to memory with author information
4. Display celebration message with progress stats

**Response Format**:
```
🚀 Feature Shipped: {feature name}

🎉 Celebration Time!
{motivational message}

📈 This Week: X features shipped
💪 Total Shipped: Y features

Keep the momentum! What's next?
```

---

### /p:next
**Show priority queue of upcoming tasks**

Displays the prioritized task queue from global storage.

**Usage**: `/p:next`

**Implementation**:
1. Read `~/.prjct-cli/projects/{id}/core/next.md`
2. Parse and format task list
3. Display with priorities and context

**Response Format**:
```
📋 Priority Queue:

1. 🔥 {high-priority task}
2. ⚡ {medium-priority task}
3. 📌 {normal-priority task}

Use /p:now {task} to start working on one!
```

---

### /p:idea <text>
**Capture ideas quickly to the backlog**

Fast brain dump for ideas without interrupting current work.

**Usage**: `/p:idea Add dark mode theme`

**Implementation**:
1. Append idea to `~/.prjct-cli/projects/{id}/planning/ideas.md` with timestamp
2. Log to memory
3. Optionally suggest adding to priority queue if actionable

**Response Format**:
```
💡 Idea captured: {idea text}

Saved to backlog. Keep your focus on current task!

Want to prioritize this? Add it to /p:next
```

---

### /p:recap
**Show project overview with progress metrics**

Comprehensive overview of current state, recent progress, and upcoming work.

**Usage**: `/p:recap`

**Implementation**:
1. Read current task from `~/.prjct-cli/projects/{id}/core/now.md`
2. Read recent shipped features from `~/.prjct-cli/projects/{id}/progress/shipped.md`
3. Read priority queue from `~/.prjct-cli/projects/{id}/core/next.md`
4. Read recent ideas from `~/.prjct-cli/projects/{id}/planning/ideas.md`
5. Calculate metrics from `~/.prjct-cli/projects/{id}/progress/metrics.md`

**Response Format**:
```
📊 Project Recap

🎯 Current Focus:
{current task or "No task set - use /p:now"}

🚀 Recently Shipped:
- {feature 1}
- {feature 2}
- {feature 3}

📋 Coming Up Next:
1. {priority 1}
2. {priority 2}
3. {priority 3}

💡 Ideas Backlog: X ideas captured

📈 Progress Metrics:
- This week: X features shipped
- This month: Y features shipped
- Total: Z features shipped
```

---

### /p:progress [period]
**Show progress metrics for specified period**

Display velocity and completion metrics for different time periods.

**Usage**:
- `/p:progress` - Default (week)
- `/p:progress day` - Today's progress
- `/p:progress week` - This week
- `/p:progress month` - This month

**Implementation**:
1. Read all entries from `~/.prjct-cli/projects/{id}/progress/shipped.md`
2. Filter by timestamp for specified period
3. Calculate metrics and velocity
4. Display formatted report

---

### /p:stuck <issue>
**Get contextual help with a problem**

Provides guidance and suggestions based on the issue description and project context.

**Usage**: `/p:stuck Having trouble with async state management`

**Implementation**:
1. Read project context from `~/.prjct-cli/projects/{id}/core/context.md`
2. Read recent memory from `~/.prjct-cli/projects/{id}/memory/context.jsonl`
3. Analyze issue description
4. Provide contextual suggestions and resources
5. Offer to break down the problem or suggest next steps

---

### /p:context
**Show project context and recent activity**

Displays project configuration, recent actions, and author information.

**Usage**: `/p:context`

**Implementation**:
1. Read `.prjct/prjct.config.json` for project metadata
2. Read recent entries from `~/.prjct-cli/projects/{id}/memory/context.jsonl`
3. Display project info, author, recent actions, and timestamps

**Response Format**:
```
📁 Project Context

🆔 Project: {project-id}
👤 Author: {name} ({github})
📍 Location: {project-path}
💾 Data: ~/.prjct-cli/projects/{id}/

🕒 Recent Activity:
- {timestamp}: {action 1}
- {timestamp}: {action 2}
- {timestamp}: {action 3}

📊 Current State: {summary}
```

---

### /p:roadmap
**Show or update strategic roadmap**

Manage long-term planning and feature roadmap.

**Usage**: `/p:roadmap`

**Implementation**:
1. Read `~/.prjct-cli/projects/{id}/planning/roadmap.md`
2. Display structured roadmap with phases and milestones
3. Show progress against roadmap items

---

### /p:analyze
**Generate or update repository analysis**

Creates comprehensive analysis of project structure, dependencies, and architecture.

**Usage**: `/p:analyze`

**Implementation**:
1. Analyze project structure and dependencies
2. Generate summary in `~/.prjct-cli/projects/{id}/analysis/repo-summary.md`
3. Update project context
4. Display key insights

---

### /p:task
**Break down and execute complex tasks**

Systematic approach to complex multi-step tasks with tracking.

**Usage**: `/p:task Refactor authentication module`

**Implementation**:
1. Break down task into subtasks
2. Create execution plan
3. Track progress through subtasks
4. Update memory and metrics

---

### /p:git
**Smart git operations with context**

Intelligent git workflows integrated with prjct context.

**Usage**: `/p:git commit`, `/p:git push`, `/p:git status`

**Implementation**:
1. Read project context for intelligent commit messages
2. Execute git operations
3. Log actions to memory
4. Suggest next steps

---

### /p:fix
**Quick troubleshooting and fixes**

Rapid problem diagnosis and resolution assistance.

**Usage**: `/p:fix Build failing on CI`

**Implementation**:
1. Analyze issue description
2. Check recent changes in memory
3. Suggest fixes based on context
4. Track resolution

---

### /p:test
**Execute tests with reporting**

Run tests and maintain test coverage tracking.

**Usage**: `/p:test`, `/p:test unit`, `/p:test e2e`

**Implementation**:
1. Execute appropriate test suite
2. Analyze results
3. Update metrics
4. Suggest improvements

---

## Key Principles

1. **Single Task Focus**: Only one task in `now.md` at a time
2. **Celebration of Progress**: Ship command celebrates wins
3. **Zero Friction**: Commands integrate into AI workflow
4. **Local First**: All data stays on developer's machine
5. **Author Tracking**: Every action logged with author for future collaboration
6. **Global Architecture**: Centralized data with project-local config
7. **Multi-Editor Sync**: Commands work consistently across all AI editors

## Implementation Notes

- All file operations should be atomic
- Always log actions to memory with timestamp and author
- Maintain emoji-enhanced, momentum-focused responses
- Suggest next actions to maintain flow
- Handle missing files gracefully (create with defaults)
- Validate `.prjct/prjct.config.json` exists before operations
- Use global paths from config, never hardcode

## For Detailed Implementation

See the prjct-cli repository for complete implementation details, command handlers, and architectural documentation.
