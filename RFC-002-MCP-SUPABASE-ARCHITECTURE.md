# RFC-002: MCP + Supabase Architecture

> **Status**: Draft
> **Author**: prjct
> **Created**: 2026-01-29
> **Replaces**: Current template-based architecture

---

## Executive Summary

Pivot prjct from a **fragile template-based system** to a **robust MCP server + Supabase architecture** where:

1. **MCP Server** handles all commands deterministically
2. **Supabase** stores all project state and history
3. **Dashboard** shows real-time activity and analytics
4. **Any agent** (Claude, Cursor, OpenCode, Kiro, etc.) works via MCP standard

---

## Why This Pivot

### Current State (Broken)

```
User: "p. task add auth"
        ↓
Claude reads template (task.md)
        ↓
Claude INTERPRETS what to do
        ↓
Maybe works, maybe fails silently
        ↓
User has no visibility
```

**Problems:**
- 11 of 36 commands are completely broken
- 12 commands depend on Claude's interpretation
- Only 8 commands are truly deterministic
- Different templates for each agent (CLAUDE.md, .cursorrules, etc.)
- No visibility into what's happening
- State stored in local JSON (fragile, no sync)

### Proposed State (Solid)

```
User: "p. task add auth"
        ↓
Any agent sees MCP tool: prjct_start_task
        ↓
Agent calls: prjct_start_task({ task: "add auth" })
        ↓
MCP Server executes deterministic code
        ↓
Writes to Supabase
        ↓
Dashboard shows real-time update
        ↓
User sees: "🔵 Task started: add auth"
```

**Benefits:**
- Deterministic execution (works or fails clearly)
- One MCP server for ALL agents
- Real-time visibility via dashboard
- State in Supabase (reliable, synced, queryable)
- Analytics from real data

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ANY AI AGENT                              │
│         (Claude, Cursor, OpenCode, Kiro, Windsurf, etc.)        │
│                                                                  │
│                    Uses their own tokens                         │
│                    for thinking/analysis                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                         MCP Protocol
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MCP SERVER                                │
│                      mcp.prjct.app                               │
│                                                                  │
│   Tools (deterministic, 0 tokens):                               │
│   ├── prjct_get_state        Read current project state          │
│   ├── prjct_get_context      Get relevant files/patterns         │
│   ├── prjct_start_task       Begin a task                        │
│   ├── prjct_complete_task    Mark task done                      │
│   ├── prjct_pause_task       Pause with reason                   │
│   ├── prjct_resume_task      Resume paused task                  │
│   ├── prjct_log_decision     Record a decision/pattern           │
│   ├── prjct_sync_project     Analyze and sync project            │
│   ├── prjct_get_roadmap      Get roadmap/PRDs                    │
│   ├── prjct_update_linear    Sync with Linear                    │
│   └── prjct_ship             Ship task (PR, changelog, etc.)     │
│                                                                  │
│   Auth: API key per user                                         │
│   Rate limits: By tier                                           │
│                                                                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                  │
│                                                                  │
│   Tables:                                                        │
│   ├── users              Auth + profile                          │
│   ├── projects           Project metadata                        │
│   ├── tasks              Task history                            │
│   ├── patterns           Learned patterns                        │
│   ├── decisions          Decision log                            │
│   ├── events             Activity stream                         │
│   └── analytics          Aggregated metrics                      │
│                                                                  │
│   Realtime: Broadcasts to dashboard                              │
│   RLS: Users see only their data                                 │
│                                                                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                       Realtime subscription
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DASHBOARD                                  │
│                      prjct.app                                   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Current Task                              ⏱️ 00:23:45   │   │
│   │ 🔵 add user authentication                              │   │
│   │ Agent: backend                                          │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Activity Stream (realtime)                              │   │
│   │ 14:23 Started "add user authentication"                 │   │
│   │ 14:25 Pattern applied: "JWT with httpOnly cookies"      │   │
│   │ 14:28 Decision logged: "Using Lucia for auth"           │   │
│   │ 14:31 Working...                                        │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ This Week                                               │   │
│   │ Tasks: 12 completed │ Time: 8h 23m │ Patterns: +3       │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Supabase)

### users

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  tier text default 'free' check (tier in ('free', 'pro', 'team')),
  api_key text unique default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### projects

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  path text, -- local path hint
  stack jsonb default '{}', -- detected stack
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Free tier: max 3 projects per user
  constraint max_projects check (
    (select count(*) from projects where user_id = user_id) <=
    case when (select tier from users where id = user_id) = 'free' then 3 else 1000 end
  )
);
```

### tasks

```sql
create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  status text default 'active' check (status in ('active', 'paused', 'completed', 'shipped')),
  agent text, -- backend, frontend, database, etc.
  started_at timestamptz default now(),
  paused_at timestamptz,
  completed_at timestamptz,
  shipped_at timestamptz,
  duration_seconds int, -- net working time
  pause_reason text,
  metadata jsonb default '{}'
);
```

### patterns

```sql
create table patterns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  category text not null, -- 'branch_naming', 'commit_style', 'library_preference', etc.
  pattern text not null,
  confidence text default 'low' check (confidence in ('low', 'medium', 'high')),
  occurrences int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### decisions

```sql
create table decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  decision text not null,
  reasoning text,
  context jsonb default '{}',
  created_at timestamptz default now()
);
```

### events

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  event_type text not null, -- 'task_started', 'task_completed', 'pattern_learned', etc.
  payload jsonb default '{}',
  created_at timestamptz default now()
);

-- Index for realtime queries
create index events_project_created on events(project_id, created_at desc);
```

### integrations

```sql
create table integrations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  provider text not null check (provider in ('linear', 'github', 'jira')),
  config jsonb default '{}', -- encrypted tokens, team IDs, etc.
  enabled boolean default true,
  created_at timestamptz default now()
);
```

---

## MCP Tools Specification

### Core Tools

#### `prjct_get_state`

Returns current project state.

```typescript
// Input
{ project_id: string }

// Output
{
  project: { id, name, stack },
  current_task: { id, title, status, duration, agent } | null,
  recent_patterns: Pattern[],
  recent_decisions: Decision[]
}
```

#### `prjct_start_task`

Starts a new task.

```typescript
// Input
{
  project_id: string,
  title: string,
  agent?: string, // auto-detected if not provided
  metadata?: object
}

// Output
{
  task: { id, title, status, agent, started_at },
  patterns_applied: Pattern[],
  context: { relevant_files: string[], stack: object }
}

// Side effects
// - Creates task record
// - Emits 'task_started' event
// - Applies relevant patterns
```

#### `prjct_complete_task`

Marks current task as done.

```typescript
// Input
{
  project_id: string,
  task_id?: string, // defaults to current
  learnings?: string[]
}

// Output
{
  task: { id, title, duration_seconds, completed_at },
  patterns_learned: Pattern[],
  next_suggested: Task[]
}

// Side effects
// - Updates task status
// - Calculates net duration
// - Extracts patterns from learnings
// - Emits 'task_completed' event
```

#### `prjct_pause_task`

Pauses current task with reason.

```typescript
// Input
{
  project_id: string,
  reason?: string
}

// Output
{
  task: { id, title, status: 'paused', paused_at }
}
```

#### `prjct_resume_task`

Resumes a paused task.

```typescript
// Input
{
  project_id: string,
  task_id?: string // defaults to most recent paused
}

// Output
{
  task: { id, title, status: 'active' },
  context: { where_you_left_off: string }
}
```

#### `prjct_log_decision`

Records a decision for future reference.

```typescript
// Input
{
  project_id: string,
  decision: string,
  reasoning?: string,
  context?: object
}

// Output
{
  decision: { id, decision, created_at },
  pattern_candidate: boolean // if this might become a pattern
}
```

#### `prjct_get_context`

Returns relevant context for current work.

```typescript
// Input
{
  project_id: string,
  task?: string, // optional task description for filtering
  include?: ['patterns', 'decisions', 'stack', 'history']
}

// Output
{
  stack: { frontend, backend, database, testing, ... },
  patterns: Pattern[],
  decisions: Decision[],
  history: { recent_tasks, common_agents }
}
```

#### `prjct_sync_project`

Analyzes project and updates state.

```typescript
// Input
{
  project_id: string,
  project_path: string // for stack detection
}

// Output
{
  stack: { ... },
  files_analyzed: number,
  patterns_detected: Pattern[],
  agents_recommended: string[]
}

// Note: Stack detection runs on user's machine via CLI helper
// MCP server stores the results
```

#### `prjct_ship`

Ships completed task.

```typescript
// Input
{
  project_id: string,
  task_id?: string,
  pr_title?: string,
  update_linear?: boolean
}

// Output
{
  task: { id, status: 'shipped', shipped_at },
  pr_url?: string,
  linear_updated?: boolean
}
```

### Integration Tools

#### `prjct_linear_sync`

Syncs with Linear.

```typescript
// Input
{
  project_id: string,
  action: 'fetch' | 'update_status' | 'add_comment',
  issue_id?: string,
  status?: string,
  comment?: string
}

// Output
{
  success: boolean,
  issue?: LinearIssue
}
```

---

## Pricing Tiers

### Free

```
- 3 projects max
- Full MCP functionality
- Dashboard (basic)
- 30-day history
- Community support
```

### Pro ($8/mo)

```
- Unlimited projects
- Full dashboard + analytics
- Unlimited history
- Linear/GitHub integrations
- Email support
- API access
```

### Team ($12/seat/mo)

```
- Everything in Pro
- Shared workspace
- See team activity
- Handoffs between members
- Team analytics
- Priority support
- Min 3 seats
```

---

## User Setup Flow

### 1. Sign up at prjct.app

```
- Email/password or GitHub OAuth
- Get API key
```

### 2. Add MCP server to agent config

**Claude Code** (`~/.claude/mcp_servers.json`):
```json
{
  "prjct": {
    "url": "https://mcp.prjct.app",
    "headers": {
      "Authorization": "Bearer YOUR_API_KEY"
    }
  }
}
```

**Cursor** (Settings → MCP):
```json
{
  "prjct": {
    "url": "https://mcp.prjct.app",
    "apiKey": "YOUR_API_KEY"
  }
}
```

### 3. Initialize project

```
User: "Initialize prjct for this project"
Agent calls: prjct_sync_project({ project_path: "/path/to/project" })
Done.
```

### 4. Start working

```
User: "Start task: add user authentication"
Agent calls: prjct_start_task({ title: "add user authentication" })
Dashboard shows: 🔵 Task started
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1-2)

- [ ] Supabase project setup
- [ ] Database schema
- [ ] Auth (Supabase Auth)
- [ ] Basic MCP server (TypeScript)
- [ ] Core tools: get_state, start_task, complete_task

### Phase 2: MCP Server (Week 2-3)

- [ ] All core tools implemented
- [ ] Rate limiting by tier
- [ ] Error handling
- [ ] Logging
- [ ] Deploy to Cloudflare Workers or similar

### Phase 3: Dashboard (Week 3-4)

- [ ] Next.js app
- [ ] Supabase realtime integration
- [ ] Current task view
- [ ] Activity stream
- [ ] Basic analytics

### Phase 4: Integrations (Week 4-5)

- [ ] Linear integration
- [ ] GitHub integration (optional)
- [ ] CLI helper for local operations (stack detection)

### Phase 5: Polish & Launch (Week 5-6)

- [ ] Pricing/billing (Stripe)
- [ ] Onboarding flow
- [ ] Documentation
- [ ] Landing page updates
- [ ] Beta launch

---

## Migration Path

### For Existing Users

1. Sign up at prjct.app
2. Get API key
3. Add MCP server to agent config
4. Import existing patterns (optional CLI tool)

### For Current Templates

Templates become **deprecated**. MCP is the future.

We can keep a minimal template that says:
```markdown
This project uses prjct MCP server.
Configure your agent to use: https://mcp.prjct.app
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Setup time | < 2 minutes |
| Command reliability | 99.9% (vs current ~60%) |
| Dashboard load time | < 1 second |
| User activation | 50% complete first task |
| Free → Pro conversion | 10% |

---

## Open Questions

1. **CLI helper**: Do we need a local CLI for stack detection, or can we do it differently?

2. **Offline**: What happens if Supabase is down? Queue locally and sync?

3. **Existing data**: Migration tool for current JSON state?

4. **Team namespaces**: How do team projects work?

---

## Conclusion

This pivot transforms prjct from a fragile template-based hack into a robust, scalable product:

- **Deterministic** execution via MCP
- **Real-time visibility** via Supabase + Dashboard
- **Works with any agent** via MCP standard
- **Clear pricing** justified by infrastructure costs
- **Defensible moat**: integrated context + history + patterns

The execution is substantial but achievable in 5-6 weeks.

---

*This RFC proposes the foundation for prjct 2.0 — a real product, not a prototype.*
