---
allowed-tools: [Read, Write, Edit, TodoWrite]
description: "Complete task, clear focus"
---

# /p:done

## Context Validation

**Prerequisites:**
- Project must be initialized (`.prjct/prjct.config.json` exists)
- Active task must exist (`core/now.md` has content)

**If context is missing, Claude provides conversational response:**
```
✨ You're not working on anything right now!

Want to start something?
• Tell me what you want to build
• Say "show me what's next"
• Or use: /p:now | /p:next

Let's ship something!
```

**Validation happens automatically through CLAUDE.md instructions - Claude checks context before executing!**

## Usage
```
/p:done
```

## Execution

**Only runs if context validation passes ✅**

1. Read task from `~/.prjct-cli/projects/{id}/core/now.md`, calculate duration
2. Clear `core/now.md`
3. **Trigger Scribe Agent** (Documentation):
   - Get git changes since task started: `git diff --name-only`
   - Invoke Scribe agent to document changes
   - Show documentation draft to user
   - **Request confirmation** before saving
   - Save to `analysis/task-docs/[task-id].md` if confirmed
4. Update `progress/metrics.md`, `core/context.md`
5. Log to `memory/context.jsonl`:
   ```json
   {"action":"done","task":"[task]","started":"[t1]","completed":"[t2]","duration":"[min]","documented":true,"layer":"core"}
   ```
6. Response:
   ```
   ✅ [task description] ([duration])

   What's next?
   • "start [next task]" → Begin working
   • "ship this feature" → Track & celebrate
   • "add new idea" → Brainstorm

   Or use: /p:now | /p:ship | /p:idea
   ```

   Or if queue empty:
   ```
   ✅ [task description] ([duration])

   Queue is empty! What now?
   • "add a task" → Plan next work
   • "brainstorm ideas" → Creative mode
   • "see my progress" → View achievements

   Or: /p:idea | /p:next | /p:recap
   ```

## Scribe Agent Workflow

When a task is completed, the Scribe agent is automatically invoked to document changes:

### Step 1: Detect Changes
```javascript
const gitIntegration = require('../core/git-integration')
const taskStartTime = readTaskStartTime()

// Get files changed since task started
const changes = await gitIntegration.getChangesSince(taskStartTime)
```

### Step 2: Generate Documentation
Invoke Scribe agent with prompt:
```
Document the following task completion:

Task: "[task description]"
Duration: [duration]
Files changed:
${changes.files.join('\n')}

Generate documentation including:
1. Brief summary of what was implemented
2. Key technical decisions
3. Files affected and their purpose
4. Any breaking changes or important notes

Keep it concise (< 200 words).
```

### Step 3: Show Draft & Request Confirmation
```
📝 Scribe Agent Documentation Draft

## Task: [task description]

**Implemented**: [date]
**Duration**: [duration]

**Summary**:
[AI-generated summary]

**Technical Details**:
- [Key decisions]
- [Files modified]

**Usage**:
[Examples if applicable]

─────────────────────────────────────

Save this documentation? (y/n): _
```

### Step 4: Save if Confirmed
```javascript
if (userConfirms) {
  const docPath = `~/.prjct-cli/projects/{id}/analysis/task-docs/${taskId}.md`
  await saveDocumentation(docPath, documentation)
  console.log('✅ Documentation saved!')
} else {
  console.log('ℹ️  Documentation discarded')
}
```

## Example with Scribe

```
/p:done

✅ implement login authentication (2h 15m)

📝 Scribe Agent is documenting your changes...

─────────────────────────────────────────────

## Task: implement login authentication

**Implemented**: 2025-10-02
**Duration**: 2h 15m

**Summary**:
Implemented JWT-based authentication system with login and registration endpoints. Added middleware for protected routes and session management.

**Technical Details**:
- Added auth service with bcrypt password hashing
- Created login/register API endpoints in auth.controller.ts
- Implemented JWT middleware for route protection
- Added user session management with Redis

**Files Modified**:
- src/features/auth/auth.service.ts (new)
- src/features/auth/auth.controller.ts (new)
- src/middleware/jwt.middleware.ts (new)
- src/config/redis.config.ts (modified)

**Breaking Changes**: None

─────────────────────────────────────────────

Save this documentation? (y/n): y

✅ Documentation saved to task-docs!

What's next?
• "start next task" → Begin working
• "ship authentication" → Track & celebrate

Or use: /p:now | /p:ship
```

## Notes

- Scribe agent uses git history to understand changes
- Documentation is saved per-task for reference
- User confirmation prevents unwanted docs
- Can skip documentation by saying "no"
- Documentation helps with onboarding and code reviews