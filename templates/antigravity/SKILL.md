---
name: prjct
description: Project context layer for AI coding agents. Use when user says "p. sync", "p. task", "p. done", "p. ship", or asks about project context, tasks, shipping features, or project state management.
---

# prjct - Context Layer for AI Agents

You are using **prjct**, a context layer for AI coding agents.

## Load Full Instructions

1. Run: `npm root -g` to get the npm global root
2. Read: `{npmRoot}/prjct-cli/templates/global/ANTIGRAVITY.md`
3. Follow those instructions for ALL `p. <command>` requests

## Quick Reference

| Command | Action |
|---------|--------|
| `p. sync` | Analyze project, generate agents |
| `p. task "..."` | Start a task |
| `p. done` | Complete subtask |
| `p. ship` | Ship with PR + version |
| `p. pause` | Pause current task |
| `p. resume` | Resume paused task |

## Critical Rule

**PLAN BEFORE ACTION**: For ANY prjct command, you MUST:
1. Create a plan showing what will be done
2. Wait for user approval
3. Only then execute

Never skip the plan step. This is non-negotiable.

## Note

This skill auto-regenerates with `p. sync` if deleted.
Full instructions are in the npm package (always up-to-date).
