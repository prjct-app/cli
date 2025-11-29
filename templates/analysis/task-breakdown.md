---
name: task-breakdown
description: Break down a feature into actionable tasks
allowed-tools: [Read, Glob, Grep]
---

# Feature Task Breakdown

Analyze the feature description and break it into concrete, actionable tasks.

## Input
- Feature: {{feature}}
- Project path: {{projectPath}}

## Analysis Steps

1. **Understand the Feature**
   - Read related code if paths are obvious
   - Identify affected systems
   - Note existing patterns to follow

2. **Identify Components**
   - What new files/modules are needed?
   - What existing code needs modification?
   - What tests are required?

3. **Order by Dependencies**
   - Foundation tasks first (models, types, interfaces)
   - Core logic second
   - Integration third
   - Tests and polish last

4. **Size Each Task**
   - Each task should be 20-60 minutes
   - If larger, break down further
   - If smaller, combine with related task

## Output Format

Return a numbered task list:
```
1. [20m] Task description - specific action
2. [30m] Another task - what exactly to do
3. [45m] Final task - clear deliverable
```

## Guidelines

- Tasks must be specific and actionable
- Include time estimates in brackets
- Order matters - dependencies first
- Don't assume - if unsure, read code first
- Match project patterns (read existing code)
