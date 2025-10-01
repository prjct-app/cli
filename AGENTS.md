# AGENTS.md - OpenAI Codex Configuration

This file provides guidance to OpenAI Codex and other AI assistants when working with this repository.

## How Codex Uses prjct Commands

OpenAI Codex does not support custom slash commands. Instead:

1. **User speaks naturally**: "set my current task to implement authentication"
2. **Codex interprets context**: Understands this is a prjct command from AGENTS.md
3. **Codex executes CLI**: Runs `prjct now "implement authentication"`
4. **CLI operates on global data**: Reads/writes `~/.prjct-cli/projects/{id}/`

**Syntax for Codex**: `prjct <command> [arguments]`

Examples:
- `prjct now "build login page"`
- `prjct ship "user authentication"`
- `prjct idea "add dark mode"`

## MCP Server Integration

**Context7 MCP is ALWAYS available** for library documentation and framework patterns:

- **Purpose**: Official library documentation lookup
- **Usage**: Automatic when importing libraries or asking about frameworks
- **Examples**: React hooks, Vue composition API, Next.js patterns, Express middleware

**When to use Context7**:
- Implementing features with external libraries
- Framework-specific questions (React, Vue, Angular, Next.js)
- API documentation lookup
- Best practices for libraries

**Other MCP Servers**:
- **Filesystem**: Direct file manipulation (always available)
- **Memory**: Persistent decision storage (always available)
- **Sequential**: Deep reasoning for complex problems (always available)

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

### /p:design
**Design system architecture, APIs, and component interfaces**

Create technical designs with visual diagrams and implementation guides for system architecture, APIs, components, databases, and user flows.

**Usage**: `/p:design [target] [--type architecture|api|component|database|flow] [--format diagram|spec|code|all]`

**Implementation**:
1. Parse design target and type (architecture, api, component, database, flow)
2. Generate appropriate ASCII diagrams and visual representations
3. Create technical specifications with technology stack and patterns
4. Generate implementation templates and interfaces
5. Save designs to `~/.prjct-cli/projects/{id}/designs/` directory
6. Display formatted design with overview, specs, and implementation guide
7. Link designs to tasks and track implementation progress

**Response Format**:
```
🎨 ✨ Design Complete! ✨ 🎨

📐 Design: [Target Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏗️ Architecture Overview:
[ASCII diagram or description]

📋 Technical Specifications:
• Technology Stack: [stack details]
• Design Patterns: [patterns used]
• Key Components: [component list]

📦 Implementation Guide:
1. Set up project structure
2. Implement core models
3. Build API endpoints
4. Create UI components

📁 Files Created:
• .prjct/designs/[target]-architecture.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Design ready for implementation!

💡 Next: /p:now "Implement [target]"
```

---

### /p:cleanup
**Advanced code cleanup and optimization**

Remove dead code, optimize imports, clean project structure, analyze unused dependencies, and clean up temporary files. Comprehensive cleanup with backup capabilities.

**Usage**: `/p:cleanup [target] [--type code|imports|files|deps|memory|all] [--safe|--aggressive] [--dry-run]`

**Implementation**:
1. Read `.prjct/prjct.config.json` for project ID and author
2. Parse cleanup arguments (target, type, mode)
3. Create backup to `~/.prjct-cli/projects/{id}/backups/{timestamp}/` before aggressive cleanup
4. Execute cleanup by type:
   - **code**: Remove console.logs, commented code, dead code
   - **imports**: Remove unused imports, organize imports
   - **files**: Remove temp files, empty files, backups
   - **deps**: Analyze and remove unused npm dependencies
   - **memory**: Archive old memory entries (>30 days) to `~/.prjct-cli/projects/{id}/memory/archive/`
   - **all**: All cleanup types
5. Validate syntax after changes (JavaScript/TypeScript)
6. Log all changes to `~/.prjct-cli/projects/{id}/memory/cleanup-log.jsonl`
7. Log action with author to context.jsonl
8. Display cleanup results with metrics

**Response Format**:
```
🧹 ✨ Cleanup Complete! ✨ 🧹

📊 Cleanup Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗑️ Dead Code Removed:
• Console.logs: {count} statements
• Commented code: {count} blocks
• Unused functions: {count}

📦 Imports Optimized:
• Unused imports: {count} removed
• Files organized: {count}

📁 Files Cleaned:
• Temp files: {count} removed
• Empty files: {count} removed
• Space freed: {size} MB

📚 Dependencies:
• Unused packages: {count} removed
• Size reduced: {size} MB

📦 Archived:
• Memory entries: {count} (older than 30 days)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Your project is clean and optimized!

💡 Tip: Run with --dry-run first to preview changes
```

**Safety Measures**:
- Create backup before aggressive cleanup
- Log all changes to cleanup-log.jsonl
- Validate syntax after modifications
- Skip files with uncommitted git changes
- Provide --dry-run option to preview

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
