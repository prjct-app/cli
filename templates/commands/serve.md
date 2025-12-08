---
allowed-tools: [Bash]
description: 'Start prjct web server'
---

# /p:serve - Start Web Server

## Overview
Starts the prjct web interface with Claude Code CLI integration.

**CRITICAL**: Uses your Claude subscription via PTY - NO API costs!

## Usage

```bash
# Start with defaults (port 3333)
prjct-serve

# Custom port
prjct-serve --port=8080
```

## What It Does

1. **Starts API Server** (Hono)
   - REST endpoints for projects, sessions, tasks
   - WebSocket for Claude Code CLI interaction
   - SSE for real-time updates

2. **Starts Web App** (React + Vite)
   - Dashboard with metrics
   - Terminal with xterm.js
   - Session history

3. **PTY Manager**
   - Spawns Claude Code CLI in pseudo-terminal
   - Streams I/O via WebSocket
   - Uses YOUR subscription - $0 API costs

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (localhost:3000)                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │  React App                                       │   │
│  │  ├── Dashboard (metrics, projects)              │   │
│  │  ├── Terminal (xterm.js)                        │   │
│  │  └── Sessions (history)                         │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                    WebSocket                            │
│                         │                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Hono Server (localhost:3333)                   │   │
│  │  ├── /api/projects                              │   │
│  │  ├── /api/sessions                              │   │
│  │  ├── /api/claude/sessions                       │   │
│  │  └── /ws/claude/:sessionId                      │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                   PTY (node-pty)                        │
│                         │                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Claude Code CLI                                │   │
│  │  (your subscription, no API costs)              │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Endpoints

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET | List all projects |
| `/api/projects/:id` | GET | Get project details |
| `/api/projects/:id/status` | GET | Get project status |
| `/api/sessions` | GET | List sessions |
| `/api/sessions/current` | GET | Get current session |
| `/api/sessions` | POST | Create session |
| `/api/sessions/:id/pause` | POST | Pause session |
| `/api/sessions/:id/resume` | POST | Resume session |
| `/api/sessions/:id/complete` | POST | Complete session |
| `/api/claude/status` | GET | Check Claude CLI availability |
| `/api/claude/sessions` | GET | List PTY sessions |
| `/api/claude/sessions` | POST | Create PTY session |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `/ws/claude/:sessionId` | Real-time Claude CLI interaction |

**Messages:**
- `{ type: 'input', data: string }` - Send input to CLI
- `{ type: 'resize', cols: number, rows: number }` - Resize terminal
- `{ type: 'output', data: string }` - Receive CLI output

## Requirements

- Node.js 18+
- Claude Code CLI installed (`claude` command available)
- Active Claude subscription (Max or similar)

## Output

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ⚡ prjct - Developer Momentum                          ║
║                                                           ║
║   API:     http://localhost:3333                          ║
║   Web:     http://localhost:3000                          ║
║   Claude:  ws://localhost:3333/ws/claude                  ║
║                                                           ║
║   Using your Claude subscription - $0 API costs           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```
