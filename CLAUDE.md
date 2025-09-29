# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**prjct-cli** is an AI-integrated project management framework designed for indie hackers and solopreneurs. It provides frictionless progress tracking through AI assistant commands without traditional project management overhead.

## Architecture

The system operates as an AI Assistant Enhancement Framework using:
- **MCP (Model Context Protocol) servers** for AI integration
- **Local filesystem storage** in `.prjct/` directory
- **Slash commands** (`/p:*`) executed within AI context

## Core File Structure

```
.prjct/
├── now.md       # Current focus (single task)
├── next.md      # Prioritized queue
├── shipped.md   # Completed features (wins)
├── ideas.md     # Brain dump
└── memory.jsonl # Decision history
```

## Command System

The project implements a slash command system for AI assistants:

### Work Commands
- `/p:now [task]` - Set/show current task
- `/p:next` - Show priority queue
- `/p:done` - Complete current task
- `/p:ship <feature>` - Ship & celebrate a feature

### Planning Commands
- `/p:idea <text>` - Capture ideas quickly
- `/p:recap` - Overview of progress
- `/p:progress [period]` - Show progress metrics

### Context Commands
- `/p:init` - Initialize project
- `/p:stuck <issue>` - Get help with problems
- `/p:context` - Show project context

## MCP Integration

The system integrates with MCP servers:
- **Context7**: Library documentation lookup
- **Filesystem**: Direct file manipulation
- **Memory**: Persistent decision storage
- **Sequential**: Deep reasoning for complex problems

## Development Guidelines

When implementing commands:
1. Commands should execute via MCP filesystem operations
2. Update relevant `.prjct/` files atomically
3. Return formatted responses with appropriate emojis
4. Always suggest next actions to maintain momentum

## Key Design Principles

- **Zero friction**: Commands integrate into existing AI workflow
- **Single task focus**: One task in `now.md` at a time
- **Celebration of progress**: The `/p:ship` command celebrates wins
- **Local-first**: All data stays on the developer's machine
- **No ceremonies**: No sprints, story points, or traditional PM overhead