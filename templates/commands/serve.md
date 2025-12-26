---
allowed-tools: [Read, Bash]
description: 'Start prjct web server for dashboard access'
timestamp-rule: 'GetTimestamp() for session start'
architecture: 'HTTP server with REST API and SSE'
---

# /p:serve - Start Web Server

Starts the prjct HTTP server for web dashboard access and API.

## Usage

```
/p:serve [port]
```

- `port`: Optional port number (default: 3478)

## Flow

### Step 1: Validate Project
1. Read `.prjct/prjct.config.json` → extract projectId
2. If not found: "No prjct project. Run /p:init first." → STOP

### Step 2: Check Port
1. Default port: 3478 ("prjct" on phone keypad)
2. If port specified, validate it's a number between 1024-65535
3. Check if port is available

### Step 3: Start Server
Execute with Bun:
```bash
bun -e "
const { startServer } = require('./core/server');
startServer('{projectId}', '{projectPath}', {port});
"
```

### Step 4: Output Server Info

```
🚀 prjct server started

   URL: http://localhost:{port}
   Project: {projectId}

   Endpoints:
   - GET  /api/state      Current task
   - GET  /api/queue      Task queue
   - GET  /api/ideas      Ideas backlog
   - GET  /api/roadmap    Feature roadmap
   - GET  /api/shipped    Shipped items
   - GET  /api/dashboard  Combined data
   - GET  /api/events     SSE stream

   Press Ctrl+C to stop
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/api/state` | GET | Current task state |
| `/api/queue` | GET | Task queue |
| `/api/ideas` | GET | Ideas backlog |
| `/api/roadmap` | GET | Feature roadmap |
| `/api/shipped` | GET | Shipped items |
| `/api/dashboard` | GET | All data combined |
| `/api/events` | GET | SSE real-time stream |
| `/api/context/:name` | GET | Context markdown files |

## Real-Time Updates (SSE)

Connect to `/api/events` for live updates:

```javascript
const events = new EventSource('http://localhost:3478/api/events');

events.addEventListener('task:started', (e) => {
  console.log('Task started:', JSON.parse(e.data));
});

events.addEventListener('task:completed', (e) => {
  console.log('Task completed:', JSON.parse(e.data));
});
```

## Event Types

- `connected` - Initial connection established
- `heartbeat` - Keep-alive ping (every 30s)
- `task:started` - New task started
- `task:completed` - Task finished
- `task:paused` - Task paused
- `feature:shipped` - Feature shipped
- `state:updated` - State changed
- `queue:updated` - Queue changed

## Error Handling

| Error | Response |
|-------|----------|
| Project not initialized | Exit with message |
| Port in use | Suggest alternative port |
| Permission denied | Request elevated permissions |

## Output Format

```
🚀 prjct server started

   URL: http://localhost:3478
   Project: abc-123-def

   Dashboard ready at http://localhost:3478
```
