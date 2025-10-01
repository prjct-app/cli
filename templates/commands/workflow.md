# Workflow System for AI Assistants

## Overview
Interactive agent workflows that orchestrate task execution with user guidance. When capabilities are missing, the system prompts for decisions rather than auto-skipping, and tracks all installation efforts as workflow tasks.

## How It Works

### 1. Automatic Workflow Detection
When a task is added via `/p:idea`, the system:
- Classifies task type: ui, api, bug, refactor, feature
- Detects project capabilities (design system, tests, docs)
- Marks steps that need user prompting when capabilities are missing
- Initializes workflow with all steps (required + optional with prompts)

### 2. Workflow Types

**UI Component** (ui):
- design (optional - needs design system)
- dev (required)
- test (optional - needs test framework)
- docs (optional - needs docs system)

**API Endpoint** (api):
- dev (required)
- test (optional - needs test framework)
- docs (optional - needs docs system)

**Bug Fix** (bug):
- analyze (required)
- fix (required)
- test (optional - needs test framework)

**Refactor** (refactor):
- refactor (required)
- test (optional - needs test framework)

**Feature** (feature):
- design (optional - needs design system)
- dev (required)
- test (optional - needs test framework)
- docs (optional - needs docs system)

### 3. Task Classification

Keywords that trigger specific workflows:

**UI**: button, form, modal, card, component, menu, nav, input
**API**: endpoint, api, service, route, controller
**Bug**: bug, fix, error, issue, broken
**Refactor**: refactor, improve, optimize, clean
**Feature**: feature, functionality, module

Default: ui

### 4. Capability Detection

The system detects capabilities by checking:

**Design System**:
- Folders: design/, designs/, .storybook/
- Dependencies: @storybook/react, @storybook/vue
- Files: *.figma

**Test Framework**:
- Dependencies: jest, vitest, mocha, @jest/core
- Files: *.test.*, *.spec.*
- Configs: jest.config.js, vitest.config.js

**Documentation**:
- Folders: docs/, documentation/
- Files: README.md
- Dependencies: typedoc, jsdoc

### 5. Interactive Workflow Execution

**When step requires missing capability:**
1. System pauses and prompts user with options:
   - Install recommended tool (based on stack detection)
   - Skip this step
   - Continue without capability
   - Pause workflow

2. If user chooses installation:
   - Creates installation task (e.g., "Install Jest")
   - Inserts task into workflow at current position
   - Tracks installation effort as visible task
   - Executes installation command
   - Configures tool automatically
   - Verifies capability is now available
   - Continues to original step

**When `/p:done` is executed:**
- Marks current step as completed
- Checks if next step needs prompting
- Shows prompt if capability missing
- Advances to next step (or completes workflow)
- Updates now.md with next step details
- Assigns appropriate agent for next step
- Logs progress to memory

### 6. Step Structure

Each step has:
- **name**: Step identifier
- **agent**: Assigned AI agent specialist
- **action**: What to do
- **required**: Must execute (true) or optional (false)
- **needs**: Required capability (if optional)
- **prompt**: Should prompt user when capability missing
- **needsPrompt**: Flag set when step needs user decision
- **retry**: Max retry attempts (for test steps)
- **type**: 'install' for dynamically inserted installation tasks

## Commands

### View Workflow Status
```
/p:workflow
```
Shows current workflow state, active step, progress.

### Skip Current Step
```
/p:workflow skip
```
Skips current optional step, moves to next.

## Example Workflows

### Full Stack (Has Everything)
```
/p:idea "Create login form"
→ Workflow: design→dev→test→docs
→ Execute each step with /p:done
```

### Missing Test Framework (Interactive)
```
/p:idea "Create button component"
→ Workflow: dev→test→docs
→ /p:done (completes dev)

⚠️  Missing test capability for "test" step

📋 Recommended: Vitest, Jest + Testing Library
💡 Reason: Quality assurance and regression prevention

Options:
1. Install recommended (npm install -D vitest @testing-library/react)
2. Skip this step
3. Continue without test
4. Pause workflow

→ User chooses: 1 (install)
→ System creates: "Install test framework" task
→ System executes: npm install -D vitest...
→ System configures: vitest.config.js created
→ Installation tracked as completed task
→ Continues to test step
```

### User Skips Missing Capability
```
/p:idea "Fix auth bug"
→ Workflow: analyze→fix→test
→ /p:done (completes fix)

⚠️  Missing test capability for "test" step
→ User chooses: 2 (skip)
→ Step skipped, workflow completes
```

### Installation Tracked as Task
```
When user installs missing tool:
1. "Install Jest" task inserted at current position
2. Installation runs: npm install -D jest
3. Configuration created: jest.config.js
4. Task marked complete with duration (e.g., 1.2 min)
5. Installation visible in workflow progress
6. Workflow continues to intended step
```

## Best Practices

1. **Never hallucinate capabilities** - Only use what exists
2. **Always prompt when capability missing** - Never auto-skip, ask user first
3. **Track all installation efforts** - Every tool install becomes a visible task
4. **Recommend based on stack** - Detect framework and suggest appropriate tools
5. **Clear handoffs** - Each step completes before next starts
6. **Agent assignment** - Right specialist for each step
7. **State tracking** - Workflow progress and installations logged to memory

## Error Handling

- If workflow init fails, task is still created (degrades gracefully)
- Missing capabilities = prompt user, don't auto-skip or fail
- Installation failures = notify user, offer alternatives or skip
- Test failures can retry up to configured limit
- Workflow can be cleared manually if needed

## State Management

Workflow state stored in:
```
~/.prjct-cli/projects/{id}/workflow/state.json
```

Contains:
- task: Task description
- type: Workflow type
- caps: Detected capabilities
- steps: All workflow steps (including dynamically inserted install tasks)
- missingCapabilities: Array of capabilities that need prompting
- current: Current step index
- active: Workflow active flag
- timestamps: Created, completed

Each step tracks:
- status: pending, in_progress, completed, skipped
- needsPrompt: Boolean flag for user decision required
- type: 'install' for installation tasks
- insertedAt: Timestamp for dynamically added tasks
- skipReason: Why step was skipped (if user chose skip)
