---
allowed-tools: [Read, Write, Edit, MultiEdit, Bash, Glob, TodoWrite]
description: 'Initialize prjct project structure in current directory'
---

# /p:init - Initialize Project

## Purpose

Initialize a new prjct structure in the current project directory.

## Usage

```
/p:init
```

## Execution

1. Create layered `.prjct/` directory structure
2. Initialize organized files in appropriate layers
3. Set up initial templates with project context
4. Run automatic repository analysis
5. Confirm initialization success

## Implementation

When this command is triggered:

1. **Create layered directory structure**:

   ```bash
   mkdir -p .prjct/{core,progress,planning,analysis,memory}
   ```

2. **Initialize core files**:
   - **core/now.md**:

     ```markdown
     # NOW: No current task

     Start a new task with `/p:now [task description]`
     ```

   - **core/next.md**:

     ```markdown
     # NEXT - Priority Queue

     Add tasks here that should be done after the current task.
     ```

   - **core/context.md**:

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

3. **Initialize progress tracking**:
   - **progress/shipped.md**:

     ```markdown
     # SHIPPED - Completed Features

     ## Week [CURRENT_WEEK], [YEAR]

     _Ship features with `/p:ship <feature>`_
     ```

   - **progress/metrics.md**:

     ```markdown
     # Progress Metrics

     ## This Week

     - **Shipped**: 0 features
     - **Active**: 0 tasks
     - **Planned**: 0 items

     ## Historical

     [Auto-updated by commands]
     ```

4. **Initialize planning layer**:
   - **planning/ideas.md**:

     ```markdown
     # IDEAS - Brain Dump

     Capture ideas quickly with `/p:idea <text>`

     ## Backlog

     - [ ] [Ideas will appear here]

     ## Someday/Maybe

     - [ ] [Future ideas]
     ```

   - **planning/roadmap.md**:

     ```markdown
     # Roadmap

     ## Current Sprint

     [Active items from next.md]

     ## Upcoming

     [Planned features and improvements]

     ## Long-term Vision

     [Strategic goals and objectives]
     ```

5. **Initialize analysis layer**:
   - **analysis/** (will be populated by `/p:analyze`)
   - Auto-run repository analysis on first init

6. **Initialize memory layer**:
   - **memory/decisions.jsonl**: Empty JSONL for decision history
   - **memory/learnings.jsonl**: Empty JSONL for project learnings
   - **memory/context.jsonl**: Empty JSONL for historical context

7. **Run automatic analysis**:
   Execute `/p:analyze` to populate initial project context

8. **Provide success message**:

   ```
   🚀 prjct initialized with layered structure!

   ## Structure Created:
   📁 .prjct/
   ├── 🎯 core/        (Current focus & priorities)
   ├── 📈 progress/    (Shipped features & metrics)
   ├── 🗺️  planning/    (Ideas, roadmap, backlog)
   ├── 🔍 analysis/    (Repository insights)
   └── 🧠 memory/      (Decision history)

   ## Quick Start:
   - `/p:analyze` - Analyze this repository
   - `/p:now [task]` - Set current focus
   - `/p:ship <feature>` - Ship & celebrate
   - `/p:roadmap` - Plan ahead
   - `/p:recap` - See progress
   ```

## Error Handling

- Check if `.prjct/` already exists
- Warn if overwriting existing files
- Provide recovery suggestions on failure
