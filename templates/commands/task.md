---
allowed-tools: [Read, Write, Edit, TodoWrite, Bash, Glob]
description: "Break down and execute complex tasks systematically"
---

## Global Architecture
This command uses the global prjct architecture:
- Data stored in: `~/.prjct-cli/projects/{id}/`
- Config stored in: `{project}/.prjct/prjct.config.json`
- Commands synchronized across all editors



# /p:task - Complex Task Execution

## Purpose
Handle complex features by breaking them down, executing systematically, and tracking progress. No overwhelm.

## Usage
```
/p:task <description>
```

## Execution
1. Analyze task complexity
2. Break into 3-7 subtasks automatically
3. Create execution plan in `.prjct/planning/tasks/`
4. Execute each subtask with validation
5. Track progress and update metrics

## Implementation

**Task breakdown**:
- Identify main components needed
- Order by dependencies
- Estimate time for each
- Create actionable subtasks

**Example breakdown**:
```
/p:task "implement user authentication"

📋 Task Plan Created:

1. Database schema (15 min)
   - User table with email/password
   - Sessions table

2. Auth middleware (30 min)
   - JWT token generation
   - Route protection

3. API endpoints (45 min)
   - POST /auth/signup
   - POST /auth/login
   - POST /auth/logout

4. Frontend forms (30 min)
   - Login component
   - Signup component

5. Testing (20 min)
   - Auth flow tests
   - Security tests

🚀 Starting execution...
[1/5] Creating database schema... ✅
[2/5] Building auth middleware... 🔄
```

**Progress tracking**:
- Real-time status updates
- Save progress between sessions
- Resume interrupted tasks
- Log to `.prjct/memory/context.jsonl`

**Response format**:
```
✅ Task completed: User authentication

📊 Execution Summary:
• Time: 2h 15min (estimated 2h 20min)
• Subtasks: 5/5 completed
• Tests: All passing
• Files: 12 created/modified

📝 Logged to: .prjct/planning/tasks/auth_system.md

💡 Next: /p:ship "user authentication"
```

## Features
- Automatic task decomposition
- Progress persistence
- Time tracking
- Dependency management
- Smart validation gates