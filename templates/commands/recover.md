---
allowed-tools: [Read, Write, Bash]
description: 'Recover abandoned session with context restoration'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
architecture: 'MD-first - MD files are source of truth'
---

# /p:recover - Recover Abandoned Session

## Purpose

Detect and recover sessions that were abandoned when Claude Code closed unexpectedly.
Shows the original prompt so the user doesn't have to rewrite it.

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{sessionPath}`: `{globalPath}/sessions/current.json`
- `{archivePath}`: `{globalPath}/sessions/archive`
- `{abandonedPath}`: `{globalPath}/sessions/abandoned`
- `{savedPath}`: `{globalPath}/sessions/saved`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`
- `{progressPath}`: `{globalPath}/progress/sessions`

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Check for Session to Recover

READ: `{sessionPath}`

IF file not found OR empty:
  OUTPUT:
  ```
  No session to recover.

  Use /p:now "task" to start a new session.
  ```
  STOP

PARSE as JSON -> {session}

IF {session.status} == "completed":
  OUTPUT:
  ```
  Last session was completed normally.

  Use /p:now "task" to start a new session.
  ```
  STOP

## Step 3: Calculate Session Age

SET: {now} = GetTimestamp()
SET: {lastActivity} = last timestamp in {session.timeline}
SET: {hoursAgo} = hours between {lastActivity} and {now}
SET: {daysAgo} = floor({hoursAgo} / 24)

## Step 4: Present Recovery Options

OUTPUT:
```
🔄 Found session to recover

Task: {session.task}
Session: {session.id}
Started: {session.startedAt}
Last activity: {hoursAgo}h ago ({daysAgo}d)
Status: {session.status}

{IF session.context.prompt exists AND length > 0:}
📝 Original prompt:
┌────────────────────────────────────────
│ {session.context.prompt}
└────────────────────────────────────────

{IF session.context.files exists AND length > 0:}
📁 Files involved:
{session.context.files.map(f => "  • " + f).join("\n")}

{IF session.estimate exists:}
⏱️  Original estimate: {session.estimate}

Options:
1. ▶️  Resume - Continue this session
2. ✅ Close - Mark as partial completion (counts in metrics)
3. 🗑️  Discard - Remove without logging
4. ⏸️  Save - Archive for later reference

Choose [1-4]:
```

WAIT for user input -> {choice}

## Step 5: Handle User Choice

### Choice 1: Resume Session

IF {choice} == 1 OR {choice} == "resume":

  ### Update session status
  SET: {session.status} = "active"
  ADD to {session.timeline}: {"type": "resume", "at": "{now}", "gapHours": {hoursAgo}}

  WRITE: `{sessionPath}` with updated {session}

  ### Update now.md
  WRITE: `{globalPath}/core/now.md`
  ```markdown
  # NOW

  **{session.task}**

  Started: {session.startedAt}
  Session: {session.id}
  Resumed: {now}
  {IF session.estimate: Estimate: {session.estimate}}
  ```

  ### Log to memory
  APPEND to: `{memoryPath}`
  ```json
  {"timestamp":"{now}","action":"session_resumed","sessionId":"{session.id}","task":"{session.task}","gapHours":{hoursAgo}}
  ```

  OUTPUT:
  ```
  ▶️ Resumed: {session.task}

  Session gap: {hoursAgo}h (noted in timeline)

  {IF session.context.prompt exists:}
  📝 Context restored:
  "{session.context.prompt}"

  /p:done when finished | /p:pause to take a break
  ```
  STOP

### Choice 2: Close as Partial

IF {choice} == 2 OR {choice} == "close":

  SET: {session.status} = "partial"
  SET: {session.completedAt} = {now}

  ### Calculate partial duration
  SET: {totalDuration} = sum of active periods in {session.timeline}
  SET: {durationFormatted} = format {totalDuration} as "Xh Xm"

  ### Archive to abandoned folder
  SET: {yearMonth} = format {now} as "YYYY-MM"
  ENSURE directory exists: `{abandonedPath}/{yearMonth}`

  WRITE: `{abandonedPath}/{yearMonth}/{session.id}.json` with {session}

  ### Log to progress (for dashboard)
  SET: {date} = format {now} as "YYYY-MM-DD"
  ENSURE directory exists: `{progressPath}/{yearMonth}`

  APPEND to: `{progressPath}/{yearMonth}/{date}.jsonl`
  ```json
  {"ts":"{now}","type":"session_partial","sessionId":"{session.id}","task":"{session.task}","duration":{totalDuration},"reason":"abandoned"}
  ```

  ### Log to memory
  APPEND to: `{memoryPath}`
  ```json
  {"timestamp":"{now}","action":"session_partial","sessionId":"{session.id}","task":"{session.task}","duration":{totalDuration},"hoursAbandoned":{hoursAgo}}
  ```

  ### Clear current session
  DELETE or EMPTY: `{sessionPath}`
  DELETE or EMPTY: `{globalPath}/core/now.md`

  OUTPUT:
  ```
  ✅ Closed as partial: {session.task}

  Duration: {durationFormatted}
  Archived to: sessions/abandoned/{yearMonth}/{session.id}.json
  Logged to: progress/sessions (will appear in dashboard)

  Use /p:now "task" to start a new session.
  ```
  STOP

### Choice 3: Discard

IF {choice} == 3 OR {choice} == "discard":

  ### Log to memory (for audit trail only)
  APPEND to: `{memoryPath}`
  ```json
  {"timestamp":"{now}","action":"session_discarded","sessionId":"{session.id}","task":"{session.task}","hoursAbandoned":{hoursAgo}}
  ```

  ### Clear current session
  DELETE or EMPTY: `{sessionPath}`
  DELETE or EMPTY: `{globalPath}/core/now.md`

  OUTPUT:
  ```
  🗑️ Discarded: {session.task}

  Session removed (not logged to metrics).

  Use /p:now "task" to start a new session.
  ```
  STOP

### Choice 4: Save for Later

IF {choice} == 4 OR {choice} == "save":

  SET: {session.status} = "saved"
  SET: {session.savedAt} = {now}

  ### Save to saved folder
  ENSURE directory exists: `{savedPath}`
  WRITE: `{savedPath}/{session.id}.json` with {session}

  ### Add to ideas.md as reminder
  READ: `{globalPath}/planning/ideas.md`

  APPEND to: `{globalPath}/planning/ideas.md`
  ```markdown

  ## Saved Session: {session.task}
  - Session: {session.id}
  - Original: {session.startedAt}
  - Saved: {now}
  {IF session.context.prompt: - Prompt: "{session.context.prompt}"}
  - Recover with: Check `sessions/saved/{session.id}.json`
  ```

  ### Log to memory
  APPEND to: `{memoryPath}`
  ```json
  {"timestamp":"{now}","action":"session_saved","sessionId":"{session.id}","task":"{session.task}"}
  ```

  ### Clear current session
  DELETE or EMPTY: `{sessionPath}`
  DELETE or EMPTY: `{globalPath}/core/now.md`

  OUTPUT:
  ```
  ⏸️ Saved for later: {session.task}

  Saved to: sessions/saved/{session.id}.json
  Added reminder to: planning/ideas.md

  Use /p:now "task" to start a new session.
  ```
  STOP

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| No session | "No session to recover" | STOP |
| Invalid choice | "Please choose 1-4" | Retry |
| Write fails | "Failed to save" | Show error |

## Examples

### Example 1: Recover with Prompt Context
```
User: /p:recover

Output:
🔄 Found session to recover

Task: Implement user authentication
Session: sess_abc12345
Started: 2025-12-09T10:00:00Z
Last activity: 26h ago (1d)
Status: active

📝 Original prompt:
┌────────────────────────────────────────
│ Necesito implementar autenticacion JWT con refresh tokens.
│ El usuario debe poder hacer login con email/password y
│ tambien con Google OAuth2. Usa la libreria jose para JWT.
└────────────────────────────────────────

📁 Files involved:
  • src/auth/index.ts
  • src/middleware/auth.ts

⏱️  Original estimate: 4h

Options:
1. ▶️  Resume - Continue this session
2. ✅ Close - Mark as partial completion
3. 🗑️  Discard - Remove without logging
4. ⏸️  Save - Archive for later

Choose [1-4]:

User: 1

Output:
▶️ Resumed: Implement user authentication

Session gap: 26h (noted in timeline)

📝 Context restored:
"Necesito implementar autenticacion JWT con refresh tokens..."

/p:done when finished | /p:pause to take a break
```

### Example 2: Close as Partial
```
User: /p:recover
[Shows session info...]

User: 2

Output:
✅ Closed as partial: Implement user authentication

Duration: 2h 15m
Archived to: sessions/abandoned/2025-12/sess_abc12345.json
Logged to: progress/sessions (will appear in dashboard)

Use /p:now "task" to start a new session.
```

### Example 3: No Session
```
User: /p:recover

Output:
No session to recover.

Use /p:now "task" to start a new session.
```
