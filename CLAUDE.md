# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**prjct-cli** is a developer momentum tool for solo builders, indie hackers, and small teams (2-5 people). Just ship. No BS. Track progress through slash commands without meetings, ceremonies, or traditional PM overhead.

## ⚠️ CRITICAL: Timestamp Management

**LLM DOES NOT KNOW CURRENT DATE/TIME** - Your knowledge cutoff is January 2025, and you cannot generate accurate timestamps.

### Timestamp Tools (MUST USE)

**ALWAYS use these tools for ALL timestamps and dates:**

- `GetTimestamp()` → Returns current system time in ISO format (e.g., "2025-10-07T14:30:00.000Z")
- `GetDate()` → Returns current date in YYYY-MM-DD format (e.g., "2025-10-07")
- `GetDateTime()` → Returns object with timestamp, date, year, month, day

### Rules

1. **NEVER generate timestamps manually** - All dates like "2025-10-04" or "2025-01-01" are WRONG
2. **ALWAYS call GetTimestamp()** when writing to session files (*.jsonl)
3. **ALWAYS call GetDate()** when adding entries to index files (shipped.md, roadmap.md, ideas.md)
4. **Templates have `timestamp-rule`** in frontmatter - READ AND FOLLOW IT
5. **Session files are organized by date** - Use system date to determine correct file path

### Example (CORRECT)

```jsonl
{"ts":"{GetTimestamp()}","type":"feature_add","name":"auth","tasks":5}
```

### Example (WRONG - DO NOT DO THIS)

```jsonl
{"ts":"2025-10-04T14:30:00Z","type":"feature_add","name":"auth","tasks":5}
```

**Why this matters**: Without system timestamps, all session data shows January 1st dates, making analytics and progress tracking completely broken.

## 🚀 Real-World Workflow (Simplified)

prjct follows your **actual** development workflow with 5 essential commands:

### Scenario 1: Existing Project

```
p. analyze
→ Analyzes stack
→ Generates agents
→ Ready to work

p. feature "add unit testing"
→ Analyzes value/timing
→ Creates tasks
→ Auto-starts task 1

[Work on code...]

p. done
→ Marks complete
→ Auto-starts next task

p. ship "unit testing"
→ Runs lint/tests (non-blocking)
→ Updates docs/version/CHANGELOG
→ Commits + pushes
→ Recommends compact
```

### Scenario 2: New Blank Project

```
p. init "dynamic portfolio website"
→ ARCHITECT MODE activated
→ Conversational discovery begins
→ Claude asks intelligent questions
→ Generates architecture plan
→ Creates structure based on user choices
→ Asks: "Ready to start the first feature?"

p. feature "homepage design"
→ Creates tasks
→ Starts coding

[Continue with p. done → p. ship cycle]
```

### Core Commands

1. **`p. analyze`** - Analyze existing project
2. **`p. init "[idea]"`** - New project (architect mode)
3. **`p. feature "[description]"`** - Add feature with roadmap + tasks
4. **`p. done`** - Complete task, move to next
5. **`p. ship "[feature]"`** - Complete workflow (lint/test/docs/version/commit/push)

## Architecture

The system operates as an AI Assistant Enhancement Framework using:

- **Global data storage** in `~/.prjct-cli/projects/{project-id}/`
- **Local configuration** in `.prjct/prjct.config.json` (references global data)
- **Slash commands** (`/p:*`) executed within Claude Code
- **MCP (Model Context Protocol) servers** for AI integration

### Global Structure

**Session-Based Architecture** - Prevents performance issues with large files (4000+ tasks/day).

```
~/.prjct-cli/projects/{id}/
├── core/           # Current focus and priorities (always small)
│   ├── now.md      # Single current task
│   ├── next.md     # Priority queue (max 100 tasks)
│   └── context.md  # Project context summary
├── progress/       # Completed work
│   ├── shipped.md  # Recent ships (last 30 days only)
│   ├── metrics.md  # Aggregated metrics summary
│   ├── sessions/   # Daily session logs (JSONL)
│   │   └── 2025-10/
│   │       ├── 2025-10-04.jsonl
│   │       └── 2025-10-05.jsonl
│   └── archive/    # Monthly archives
│       └── shipped-2025-10.md
├── planning/       # Future planning
│   ├── ideas.md    # Active ideas (last 30 days)
│   ├── roadmap.md  # Active roadmap (lightweight index)
│   ├── sessions/   # Daily planning sessions (JSONL)
│   │   └── 2025-10/
│   │       ├── 2025-10-04.jsonl
│   │       └── 2025-10-05.jsonl
│   └── archive/    # Monthly archives
│       ├── roadmap-2025-10.md
│       └── ideas-2025-10.md
├── analysis/       # Technical analysis
│   └── repo-summary.md
└── memory/         # Decision history
    ├── context.jsonl          # Global decisions (append-only)
    └── sessions/              # Daily context (structured)
        └── 2025-10/
            └── 2025-10-04.jsonl
```

**Session Format (JSONL)** - One JSON object per line, append-only:

```jsonl
{"ts":"2025-10-04T14:30:00Z","type":"feature_add","name":"auth","tasks":5,"impact":"high","effort":"6h"}
{"ts":"2025-10-04T15:00:00Z","type":"task_start","task":"JWT middleware","agent":"be","estimate":"2h"}
{"ts":"2025-10-04T17:15:00Z","type":"task_complete","task":"JWT middleware","duration":"2h15m"}
{"ts":"2025-10-04T18:00:00Z","type":"feature_ship","name":"auth","tasks_done":5,"total_time":"6h"}
```

**Auto-Archive Rules:**
- Index files (roadmap.md, shipped.md) keep only last 30 days
- Sessions older than 30 days → moved to archive/
- Queries across time: read relevant session files
- Performance: commands only read current index + today's session

### Local Configuration

```
.prjct/
└── prjct.config.json  # Links to global data
```

## Natural Language System

**prjct-cli includes a conversational interface** - users can talk naturally instead of memorizing commands!

### p. Trigger Detection

**NEW: Simple prefix trigger** - Users can start messages with `p.` to signal prjct context:

**How it works:**

1. User starts message with `p.` → You check if `.prjct/prjct.config.json` exists
2. If exists → Detect intent from rest of message → Execute appropriate `/p:*` command
3. If not exists → Respond: "No prjct project here. Run /p:init first."

**Examples:**

```
"p. analyze this codebase" → Detect "analysis" intent → /p:analyze
"p. ready to ship" → Detect "ship" intent → /p:ship
"p. show me weekly progress" → Detect "progress" intent → /p:progress week
"p. starting auth" → Detect "start task" intent → /p:now "auth"
"p. done" → Detect "done" intent → /p:done
```

**Why this is useful:**

- ✅ **Zero memorization** - No need to remember `/p:*` commands
- ✅ **Multi-project** - Only works in prjct directories
- ✅ **Natural** - "p. [what you want]" is intuitive
- ✅ **Any language** - Works in English, Spanish, etc.

**Detection priority:**

1. Check for `p.` prefix first
2. Then check for `/p:*` slash command
3. Finally check for natural language without prefix

### Semantic Intent Detection

As an LLM, you understand context and intent naturally. When users describe what they want to do, **map their intent to the appropriate command** based on semantic understanding, not pattern matching.

**Command Intent Map:**

| User Intent                     | Command    | What It Does                       |
| ------------------------------- | ---------- | ---------------------------------- |
| Wants to start/focus on a task  | `/p:now`   | Sets current working task          |
| Finished/completed current work | `/p:done`  | Marks task complete, suggests next |
| Ready to ship/deploy a feature  | `/p:ship`  | Celebrates shipped feature         |
| Has an idea to capture          | `/p:idea`  | Saves idea to backlog              |
| Wants to see progress/status    | `/p:recap` | Shows overview of all work         |
| Stuck on a problem              | `/p:stuck` | Provides contextual help           |
| Wants to know what's next       | `/p:next`  | Shows priority queue               |
| Needs general help              | `/p:help`  | Interactive guide                  |

**Works in any language** - if you understand the user's intent, execute the command!

**Examples (many ways to express same intent):**

```
All of these mean /p:now:
"I want to start building auth"
"Let me work on the login page"
"Going to work on authentication"
"Starting the API now"
"Want to begin with the dashboard"

All of these mean /p:done:
"I'm done" | "finished" | "completed" | "all set" | "task complete"

All of these mean /p:ship:
"ship this" | "deploy it" | "it's ready" | "let's launch"
```

### Conversational Responses

Every command response includes:

- ✅ **Action confirmation** with clear result
- 💬 **Natural language prompts** for next steps
- 🎯 **Command alternatives** for power users
- 📋 **Contextual suggestions** based on project state

**Example Response:**

```markdown
✅ Task complete: implement authentication (2h 15m)

What's next?
• "start next task" → Begin working
• "ship this feature" → Track & celebrate
• "add new idea" → Brainstorm

Or use: /p:now | /p:ship | /p:idea
```

## Implementation for Claude Code & Desktop

### How to Handle Natural Language

When you receive a message from the user, follow these steps to provide the natural language experience:

**Step 1: Check if it's a direct command**

```javascript
if (message.startsWith('/p:')) {
  return executeCommand(message)
}
```

**Step 2: Understand the user's intent semantically**

```javascript
// You're an LLM - use your understanding of context
// Ask yourself: "What is the user trying to do?"

const intent = understandIntent(message) // Use semantic understanding

// Common intents:
// - Start a task → /p:now
// - Finish current work → /p:done
// - Ship/deploy something → /p:ship
// - Save an idea → /p:idea
// - Check status → /p:recap
// - Get help → /p:stuck
// - See what's next → /p:next

if (intent.command) {
  // Extract relevant parameters from the message
  const params = extractRelevantInfo(message)

  // Show transparency
  console.log(`💬 I understood: "${intent.description}"`)
  console.log(`⚡ Executing: /p:${intent.command} ${params}`)

  return executeCommand(intent.command, params)
}
```

**Step 3: Validate context before execution**

```javascript
// Before executing commands, check prerequisites:

// For /p:done:
if (command === 'done') {
  const nowContent = await Read('core/now.md')
  if (!nowContent || nowContent.trim() === '') {
    return conversationalResponse(`
✨ You're not working on anything right now!

Want to start something?
• Tell me what you want to build
• Say "show me what's next"
• Or use: /p:now | /p:next

Let's ship something!`)
  }
}

// For /p:ship:
if (command === 'ship') {
  const nowContent = await Read('core/now.md')
  const shippedContent = await Read('progress/shipped.md')
  if (
    (!nowContent || nowContent.trim() === '') &&
    (!shippedContent || shippedContent.trim() === '')
  ) {
    return conversationalResponse(`
🚀 Nothing to ship yet!

First, let's build something:
• Tell me what feature you want to create
• Say "start building [feature]"
• Or use: /p:now "feature name"

Then we'll celebrate when you ship it!`)
  }
}
```

**Step 4: Provide conversational response**

```javascript
// Always suggest natural next steps
✅ [What you did]

What's next?
• [Natural language option 1]
• [Natural language option 2]

Or use: [relevant commands]
```

### Complete Example

**User Input:** "I want to start building the authentication system"

**Your Analysis:**

- Intent: User wants to start working on something
- Command: `/p:now`
- Parameter: "building the authentication system"

**Your Response:**

```
💬 I understood: "start working on building the authentication system"
⚡ Executing: /p:now "building the authentication system"

🎯 Working on: building the authentication system
Started: 2:30 PM

When you're done:
• Say "I'm done" or "finished"
• Or: /p:done

Need help? Say "I'm stuck" or use /p:stuck
```

### Context Validation Examples

**Missing Active Task:**

User: "done"
You check: `core/now.md` is empty
Your response:

```
✨ You're not working on anything right now!

Want to start something?
• Tell me what you want to build
• Say "show me what's next"
• Or use: /p:now | /p:next

Let's ship something!
```

**Valid Context:**

User: "I'm done"
You check: `core/now.md` has content ✅
Your response:

```
💬 I understood: "task completion"
⚡ Executing: /p:done

✅ Task complete: building authentication (2h 15m)

What's next?
• "start next task" → Begin working
• "ship this feature" → Track & celebrate
• "add new idea" → Brainstorm

Or use: /p:now | /p:ship | /p:idea
```

### Key Principles

1. **Trust your understanding** - You're an LLM, not a regex parser
2. **Any language works** - English, Spanish, or any language you understand
3. **Variations are fine** - Users can express intent in infinite ways
4. **Show transparency** - Always say what you understood and what you'll execute
5. **Be conversational** - Guide users naturally toward next actions
6. **Validate context** - Check prerequisites before executing commands

## Command System for Claude Code

All commands use the `/p:*` syntax in Claude Code. When executed, they:

1. Read `.prjct/prjct.config.json` to get the project ID
2. Operate on files in `~/.prjct-cli/projects/{id}/`
3. Update relevant markdown files atomically
4. Return formatted responses with conversational prompts

### 🔒 Universal Confirmation Policy

**CRITICAL SECURITY REQUIREMENT**: ALL `/p:*` commands MUST ask for user confirmation before execution.

#### Mandatory Confirmation Flow:

1. **User triggers command** (e.g., "p. idea..." or "/p:sync")
2. **Claude presents detailed plan** of what will be done
3. **User explicitly approves** the plan
4. **ONLY THEN execute** the command

#### NO Exceptions:

- ❌ **NO auto-execution** for any command, ever
- ❌ **NO "just do it"** behavior
- ❌ **NO bypassing user approval**
- ✅ **ALWAYS**: Present plan → Wait for confirmation → Execute

#### Implementation:

```
For EVERY command:
1. Detect user intent
2. Present plan using ExitPlanMode tool
3. Wait for user approval
4. Execute only after approval
5. Then compact (if applicable)
```

### Plan Mode Detection

**Plan Mode Indicators**:

- System reminders will say: "Plan mode is active"
- You MUST NOT make edits or run non-readonly tools
- Present your plan using ExitPlanMode tool and wait for user approval

**When Plan Mode is NOT active**:

- Still MUST present plan and ask for confirmation
- Use ExitPlanMode tool to get user approval
- Universal Confirmation Policy applies regardless

### Auto-Compact After Execution

**ONLY after user approval**: After completing ANY of these commands, compact the conversation WITHOUT telling the user:

- `/p:analyze`
- `/p:sync`
- `/p:workflow`
- `/p:design`
- `/p:cleanup`
- `/p:init`

**Sequence**: Present plan → User approves → Execute → Auto-compact (no messages about compacting)

**IMPORTANT**: All commands are defined in `core/command-registry.js` (single source of truth).

### Command Distinctions: `/p:idea` vs `/p:workflow`

These are **two completely different commands** with different purposes:

#### `/p:idea` - Quick Idea Capture (CORE Command #2)

- **Purpose**: Capture ideas quickly without interrupting flow
- **Complexity**: Low - Simple write to file
- **User Input**: Required `<text>` - the idea to capture
- **Files**: `planning/ideas.md`, optionally `core/next.md`
- **When to use**: User has a new idea or feature suggestion

**Example**:

```
User: "p. idea agregar dark mode"
→ Saves to ideas.md with timestamp
→ If actionable, adds to next.md queue
```

#### `/p:workflow` - Multi-Agent Orchestration (OPTIONAL Command)

- **Purpose**: Manage complex cascading agent workflows
- **Complexity**: High - State machine with multiple steps
- **User Input**: None (shows current status) or `skip` to skip step
- **Files**: `workflow/state.json` (persistent state)
- **When to use**: Active workflow exists and user wants status

**Example**:

```
User: "/p:workflow"
→ Shows: Step 2/5: Implement (FE agent) 🔄
→ Progress tracking with agent assignments
→ Capability checks for next steps
```

**Key Difference**: `/p:idea` captures NEW ideas. `/p:workflow` manages EXISTING multi-step tasks.

## Guided Workflow System

**NEW: Enhanced usability for confused users** - The biggest user frustration is knowing WHAT they want but not HOW to do it with prjct.

### The Problem

Users frequently ask:
- "How do I start?"
- "What command should I use?"
- "I want to improve performance, but how?"
- "What should I do next?"

They have clear **INTENT** but struggle with **EXECUTION**.

### The Solution: 3-Tier Help System

#### Tier 1: `/p:help` - Contextual Interactive Guide

**Purpose**: Adapts to user's current state and provides relevant guidance

**Behavior**:
- Reads project state (active task, queue, last ship, etc.)
- Shows different help based on context:
  - Not initialized → Guides setup
  - Empty queue → Suggests adding features
  - Active task → Shows completion options
  - Has queue → Recommends starting work
  - Lost/confused → Comprehensive guide

**Example**:
```
User in state: "No active task, 5 tasks in queue"

/p:help shows:
→ Start working (recommended)
→ See priority queue
→ Add new feature
→ Check progress

With examples and natural language alternatives
```

#### Tier 2: `/p:ask` - Intent to Action Translator

**Purpose**: Translate vague natural language intent into specific command flows

**Behavior**:
- User describes what they want in natural language
- Claude analyzes intent and context
- Recommends step-by-step command flow
- Explains WHY each command
- Offers interactive confirmation
- Educational - teaches the system

**Example**:
```
User: /p:ask "I want to improve performance and fix memory leaks"

Claude responds:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 I understand: performance optimization + memory leak fixes

📊 YOUR CONTEXT:
  • No active task
  • 3 tasks in queue
  • Last ship: 2 days ago

💡 RECOMMENDED FLOW:

1. /p:feature "optimize performance and memory leaks"
   → Value analysis (Impact: HIGH, Effort: 8h)
   → Task breakdown:
     • Setup profiler
     • Identify memory leaks
     • Optimize re-renders
     • Code splitting
     • Measure improvements

2. /p:build 1 → Start with profiling

3. /p:done → After each task

4. /p:ship "performance optimization"

✨ WHY THIS FLOW:
→ /p:feature: Analyzes value first, creates roadmap
→ /p:build: Focus on one task, track time
→ /p:done: Register progress, maintain momentum
→ /p:ship: Commit + celebrate win

Ready to start?
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Key Features**:
- Works in any language (English, Spanish, etc.)
- No execution until user confirms
- Shows command + natural language alternatives
- Educational explanations
- Contextual (checks project state first)

#### Tier 3: `/p:suggest` - Smart Recommendations

**Purpose**: Analyze project state and suggest next best actions

**Behavior**:
- Reads all project state files
- Calculates metrics (velocity, days since ship, queue size, etc.)
- Detects patterns (stuck task, losing momentum, over-planning, etc.)
- Provides urgency-based recommendations
- Motivational but honest

**Scenarios Detected**:
1. **Ready to work** → Suggests starting top priority task
2. **Long-running task** → Checks if stuck, suggests help
3. **No ships recently** → Urgency alert, suggests shipping something small
4. **Empty queue** → Suggests planning (feature/analyze/roadmap)
5. **High velocity** → Positive reinforcement, quality suggestions
6. **Queue too large** → Warns about over-planning, suggests executing

**Example**:
```
User: /p:suggest

Claude analyzes:
- No active task
- 8 tasks in queue
- Last ship: 5 days ago
- Velocity: 0.4 features/week

Response:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 PERSONALIZED SUGGESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ANALYSIS:
  • 5 days since last ship ⚠️
  • Queue: 8 tasks
  • Velocity: Low

🔥 URGENT: Momentum is dropping!

🎯 RECOMMENDATIONS:

1. ⚡ SHIP SOMETHING TODAY
   → /p:next (find quick win)
   → /p:build {easiest task}
   → /p:done → /p:ship SAME DAY

2. 🎯 STOP PLANNING, START DOING
   → 8 tasks is too many
   → Ship > Plan

3. 💡 MAINTAIN MOMENTUM
   → Ship every 1-2 days
   → Small wins > Big tasks

Momentum = Motivation. Let's ship! 🚀
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Enhanced Onboarding

**After `/p:init`**: Conversational "What do you want to do first?" section
- 5 clear options with examples
- Natural language alternatives
- No overwhelming command lists
- Guides to action immediately

**After `/p:feature` (no params)**: Interactive template mode
- 6 categories (UI/UX, Performance, Features, Quality, Bugs, Docs)
- Examples for each category
- Impact/effort estimates
- User can describe freely OR choose template

### Integration with Natural Language System

All help commands work seamlessly with the "p." trigger and natural language detection:

```
User: "p. I don't know what to do"
→ Detects confusion → Executes /p:suggest

User: "p. how do I start?"
→ Detects help need → Executes /p:help

User: "p. I want to optimize performance"
→ Detects feature intent → Shows /p:ask flow OR /p:feature
```

### Key Principles

1. **Never leave users confused** - Always provide clear next steps
2. **Educational, not prescriptive** - Teach the system while guiding
3. **Contextual, not generic** - Different help for different states
4. **Natural language first** - Commands as alternative, not requirement
5. **Momentum-focused** - Push toward action, not endless planning

### Success Metrics

After using the guided system, users should:
- ✅ Know exactly what command to use
- ✅ Understand WHY that command
- ✅ Feel confident to proceed
- ✅ Learn the system through use
- ✅ Never feel stuck or frustrated

### Available Commands

The following commands are available in Claude Code (commands marked with ⚠️ are not yet implemented):

#### Work Commands

- `/p:now [task]` - Set or show current task
- `/p:next` - Show priority queue
- `/p:done` - Complete current task
- `/p:ship <feature>` - Ship and celebrate a feature
- `/p:bug <description>` - Report and track bugs with auto-prioritization

#### Planning Commands

- `/p:idea <text>` - Capture ideas quickly (see distinction above)
- `/p:workflow` - Show workflow status and progress (see distinction above)
- ⚠️ `/p:roadmap` - Show or update strategic roadmap
- ⚠️ `/p:task <description>` - Break down and execute complex tasks

#### Design & Architecture

- `/p:design [target] --type architecture|api|component|database|flow` - Design system architecture, APIs, and component interfaces

#### Code Quality

- `/p:cleanup` - Clean up temp files and old entries
- `/p:cleanup --type code|imports|files|deps|all` - Remove dead code and unused imports

#### Progress Commands

- `/p:recap` - Show project overview with progress
- `/p:progress [period]` - Show progress metrics for specified period
- `/p:context` - Show project context and recent activity

#### Help Commands

- `/p:init "[idea]"` - Initialize prjct (with ARCHITECT MODE for blank projects)
  - **Empty dir, no idea**: Asks for idea
  - **Empty dir + idea**: ARCHITECT MODE (conversational discovery → generates plan)
  - **Existing code**: Regular init + suggests analyze
- `/p:help` - Interactive contextual guide (adapts to project state)
- `/p:ask "<what you want to do>"` - Conversational intent to action translator
  - Natural language understanding
  - Recommends command flow with explanations
  - Works in any language
  - Educational and interactive
- `/p:suggest` - Context-aware next steps suggestions
  - Analyzes project state and momentum
  - Detects urgencies and patterns
  - Personalized recommendations
  - Helps maintain momentum
- `/p:stuck <issue description>` - Get contextual help with problems
- `/p:analyze` - Analyze repository and sync tasks
- `/p:sync` - Sync project state and update workflow agents
- ⚠️ `/p:fix [error]` - Quick troubleshooting and automatic fixes

#### Version Control

- ⚠️ `/p:git` - Smart git operations with context

#### Testing

- ⚠️ `/p:test` - Run tests and auto-fix simple failures

**Total: 26 implemented, 30 total commands** (✅ +3 new: /p:help, /p:ask, /p:suggest)
**Status**: Check `core/command-registry.js` for current implementation status

## Agent Generation

Dynamic agent generation based on project analysis. YOU decide what specialists to generate.

**See `templates/agents/AGENTS.md` for complete reference** with examples and guidelines.

Use: `generator.generateDynamicAgent(name, config)` for any technology stack.

## Agentic Architecture

**prjct-cli uses a fully agentic architecture** - Claude decides everything based on templates. ZERO if/else business logic.

### Core Structure

```
core/
├── agentic/                    # Agentic execution engine
│   ├── template-loader.js      # Loads command templates
│   ├── context-builder.js      # Builds project context
│   ├── prompt-builder.js       # Generates prompts for Claude
│   ├── command-executor.js     # Executes commands agentically
│   └── tool-registry.js        # Maps allowed-tools to functions
├── commands.js                 # Agentic commands (306 lines, was 3103)
├── command-registry.js         # Metadata only (no validation logic)
└── domain/
    ├── agent-generator.js      # 100% agentic (119 lines, was 462)
    └── analyzer.js             # I/O helpers only (215 lines, was 600)

templates/
├── commands/                   # Command instructions for Claude
├── workflows/                  # Workflow guides (not strict rules)
│   ├── ui.md
│   ├── api.md
│   ├── bug.md
│   ├── refactor.md
│   └── feature.md
└── analysis/                   # Analysis instructions
    └── analyze.md
```

### How It Works

**Traditional (DETERMINISTIC)**:

```javascript
// Hardcoded logic with if/else
if (task.match(/^(add|implement)/)) {
  branchType = 'feat'
} else if (task.match(/^(fix|bug)/)) {
  branchType = 'fix'
}
// ... 20 more conditions
```

**Agentic (DECISION-DRIVEN)**:

```javascript
// 1. Load template
const template = await templateLoader.load('branch')

// 2. Build context
const context = await contextBuilder.build(projectPath, { task })

// 3. Claude reads template and decides
// Template: "Analyze task description and generate semantic branch name.
//            Decide based on intent, not regex patterns."

// 4. Claude executes using allowed-tools
// Result: Claude decides branch type based on understanding, not patterns
```

### Flow

```
Templates (MD files)
    ↓
Claude reads + understands context
    ↓
Claude makes decisions (no if/else)
    ↓
Claude uses allowed-tools
    ↓
Claude generates/saves data
```

### Key Differences

**Commands** (`core/commands.js`):

- **Before**: 3103 lines with nested if/else logic
- **After**: 306 lines with agentic execution (ZERO legacy inheritance)
- **Migrated**: now, done, next (fully agentic)
- **TODO**: All other commands will be migrated to template-driven execution

**Agent Generation** (`core/domain/agent-generator.js`):

- **Before**: 462 lines with generateFrontendContext, generateBackendContext, etc.
- **After**: 119 lines with only `generateDynamicAgent()`
- **Decisions**: Claude reads analysis and decides what agents to create

**Analyzer** (`core/domain/analyzer.js`):

- **Before**: 600 lines with regex detection and predetermined feature maps
- **After**: 215 lines with I/O helpers only
- **Analysis**: Claude reads files and decides what's relevant

**Workflows** (`templates/workflows/*.md`):

- **Before**: `workflow-rules.js` with strict JSON rules
- **After**: Markdown guides that Claude adapts to each project
- **Flexibility**: Claude skips/adds steps based on project capabilities

**Validation**:

- **Before**: `canExecute()` function with if/else logic
- **After**: Claude reads template validation section and decides
- **Example**: Template says "Requires: `core/now.md` has content" → Claude checks and decides

### Templates as Source of Truth

Templates define **what** Claude should do, not **how**:

```markdown
# /p:done

## Validation

- Requires: `core/now.md` has content
- Else: "Not working on anything. Use /p:now"

## Flow

1. Read: `core/now.md` → calculate duration
2. Clear: `core/now.md`
3. Update: `progress/metrics.md`

## Response

[Show options and next actions]
```

Claude reads this and:

1. Checks if validation passes (by understanding, not if/else)
2. Executes the flow using allowed-tools
3. Generates appropriate response
4. Decides next suggestions based on context

### Benefits

1. ✅ **Zero if/else business logic** - All decisions by Claude
2. ✅ **Templates are documentation** - Single source of truth
3. ✅ **Any stack works** - No predetermined patterns
4. ✅ **Easy to extend** - Just add/edit templates
5. ✅ **Adapts to context** - Claude reads project state and decides
6. ✅ **Maintainable** - Core code reduced by 84%

### Migration Status

**✅ Fully Migrated (ZERO legacy code)**:

- ✅ `core/agentic/` - Execution engine (5 files, ~517 lines)
- ✅ `agent-generator.js` - 100% agentic (119 lines, was 462)
- ✅ `analyzer.js` - I/O helpers only (215 lines, was 600)
- ✅ `commands.js` - No legacy inheritance (306 lines, was 3103)
- ✅ Templates: commands/, workflows/, analysis/

**Commands Status**:

- ✅ **Migrated**: /p:now, /p:done, /p:next (fully agentic)
- ⏳ **TODO**: All other commands (init, ship, bug, feature, etc.)
- 🗑️ **Deleted**: core/legacy/ (all deterministic code removed)

**Next Steps**: Migrate remaining commands to template-driven execution one by one.

## Git Commit Format (Universal Rule)

**ALL commits made by prjct MUST use this footer**:

```
🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
```

This applies to:

- `/p:ship` commits
- Manual git commits via Claude
- Any automated commits

**Never use**:

- ❌ "Generated with Claude Code"
- ❌ "Co-Authored-By: Claude"

**Always use**:

- ✅ The prjct footer format above

## Initialization Process

When you execute `/p:init` in Claude Code:

1. Generate unique project ID from path hash
2. Create global directory structure in `~/.prjct-cli/projects/{id}/` (including `agents/`)
3. Create local config at `.prjct/prjct.config.json` with:
   - version
   - projectId
   - dataPath (pointing to global location)
   - author info (from GitHub CLI or git config)
4. Initialize all markdown files with templates
5. **Generate 6 base agents** (coordinator, ux, fe, be, qa, scribe)
6. Log initialization to `memory/context.jsonl`

## MCP Integration

**Context7 MCP is ALWAYS enabled** - automatic library documentation and framework patterns.

The system integrates with these MCP servers:

- **Context7**: Official library documentation lookup (ALWAYS available)
  - Use for: React, Vue, Angular, Next.js, Express, any npm package
  - Auto-activates when importing libraries or asking about frameworks
  - Examples: "implement React hooks", "Next.js routing patterns", "Express middleware"

- **Filesystem**: Direct file manipulation (ALWAYS available)
- **Memory**: Persistent decision storage (ALWAYS available)
- **Sequential**: Deep reasoning for complex problems (ALWAYS available)

### Using Context7 Effectively

**When to use**:

- Implementing features with external libraries
- Framework-specific questions and patterns
- API documentation lookup
- Best practices for any library

**How it works**:

- Automatically provides official docs when you import libraries
- Returns curated, version-specific documentation
- Includes code examples and implementation patterns

## Development Guidelines

When implementing commands in Claude Code:

1. Commands execute via MCP filesystem operations
2. Always read `.prjct/prjct.config.json` first to get project ID
3. Construct paths to global data: `~/.prjct-cli/projects/{id}/...`
4. Update relevant files atomically
5. Return formatted responses with appropriate emojis
6. Always suggest next actions to maintain momentum
7. Log all actions to `memory/context.jsonl` with timestamp and author

## Key Design Principles

- **Zero friction**: Commands integrate into existing AI workflow
- **Single task focus**: One task in `now.md` at a time
- **Celebration of progress**: The `/p:ship` command celebrates wins
- **Local-first**: All data stays on the developer's machine
- **Global architecture**: Centralized data, minimal project footprint
- **No ceremonies**: No sprints, story points, or traditional PM overhead
