# PRD: prjct MCP Server

## Metadata
- **Versión**: 1.0
- **Fecha**: 2026-01-30
- **Status**: Draft
- **Owner**: JJ

---

## 1. Resumen Ejecutivo

### El Problema
prjct-cli actual tiene una arquitectura frágil: 35 templates que Claude interpreta de forma variable. El 60% de los comandos no funcionan de manera confiable porque dependen de cómo el LLM "entienda" el markdown.

### La Solución
Transformar prjct en un **MCP Server** que expone tools determinísticos. Los AI agents (Claude, Cursor, Windsurf) llaman a tools con inputs estructurados y reciben outputs predecibles. El estado se persiste en Supabase, visible en tiempo real via dashboard.

### El Resultado
- **Ejecución determinística**: Tool call → función ejecuta → resultado
- **Visibilidad total**: Dashboard muestra qué está haciendo el AI
- **Compatibilidad universal**: Cualquier cliente MCP puede usar prjct
- **Monetización clara**: Free (3 proyectos), Pro ($8), Team ($12/seat)

---

## 2. Objetivos y Métricas

### Objetivos
1. **Confiabilidad**: 100% de los tools ejecutan correctamente (vs 40% actual)
2. **Visibilidad**: Usuario ve actividad del AI en tiempo real
3. **Adopción**: Funciona en Claude, Cursor, VS Code, Windsurf
4. **Revenue**: Path claro de free → paid

### Métricas de Éxito (90 días post-launch)
| Métrica | Target |
|---------|--------|
| Tools funcionando | 100% |
| Latencia promedio | <200ms |
| Usuarios activos | 100+ |
| Conversión free→pro | 5% |
| NPS | >40 |

---

## 3. Arquitectura

### Diagrama de Sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER'S MACHINE                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   Claude    │    │   Cursor    │    │  Windsurf   │              │
│  │   Desktop   │    │     IDE     │    │     IDE     │              │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘              │
│         │                  │                  │                      │
│         └──────────────────┼──────────────────┘                      │
│                            │                                         │
│                   ┌────────▼────────┐                                │
│                   │   MCP Client    │                                │
│                   │  (in each app)  │                                │
│                   └────────┬────────┘                                │
└────────────────────────────┼────────────────────────────────────────┘
                             │ HTTPS (Streamable HTTP)
                             │ Auth: JWT Bearer Token
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CLOUD (Vercel Edge)                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     prjct MCP Server                         │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │                      MCP Layer                          │ │   │
│  │  │  • Streamable HTTP Transport                            │ │   │
│  │  │  • Session Management                                   │ │   │
│  │  │  • Tool Routing                                         │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐  │   │
│  │  │    Tools     │ │  Resources   │ │       Auth           │  │   │
│  │  │ • get_state  │ │ • project:// │ │ • JWT validation     │  │   │
│  │  │ • start_task │ │ • tasks://   │ │ • Rate limiting      │  │   │
│  │  │ • complete   │ │ • patterns://│ │ • Tier enforcement   │  │   │
│  │  │ • log_decision│ └──────────────┘ └──────────────────────┘  │   │
│  │  │ • get_context│                                            │   │
│  │  │ • linear_sync│                                            │   │
│  │  └──────────────┘                                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             │ Supabase Client (pooled)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          SUPABASE                                   │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │   PostgreSQL   │  │    Realtime    │  │         Auth           │ │
│  │                │  │                │  │                        │ │
│  │ • users        │  │ • tasks INSERT │  │ • JWT signing          │ │
│  │ • projects     │  │ • events INSERT│  │ • OAuth providers      │ │
│  │ • tasks        │  │                │  │ • User management      │ │
│  │ • patterns     │  │      ▼         │  │                        │ │
│  │ • decisions    │  │  WebSocket     │  │                        │ │
│  │ • events       │  │  to Dashboard  │  │                        │ │
│  │ • integrations │  │                │  │                        │ │
│  └────────────────┘  └────────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             │ Realtime subscription
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       prjct.app Dashboard                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  📊 Live Activity                    🔄 Sync Status          │   │
│  │  ┌────────────────────────────────┐  ┌─────────────────────┐ │   │
│  │  │ 14:32 Task started: "Add auth" │  │ Linear: ✓ synced    │ │   │
│  │  │ 14:33 Decision logged          │  │ GitHub: ✓ connected │ │   │
│  │  │ 14:45 Task completed           │  │                     │ │   │
│  │  └────────────────────────────────┘  └─────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Stack Técnico

| Componente | Tecnología | Justificación |
|------------|------------|---------------|
| Language | TypeScript 5.x | Type safety, SDK oficial |
| MCP SDK | @modelcontextprotocol/server | Oficial, mantenido |
| HTTP Framework | Hono | Ligero, edge-ready, familiar |
| Validation | Zod | Requerido por SDK |
| Database | Supabase PostgreSQL | Realtime, Auth integrado |
| Hosting | Vercel Edge | Baja latencia, free tier |
| Auth | Supabase Auth + JWT | Simple, escalable |

---

## 4. MCP Tools Specification

### 4.1 prjct_get_state

**Propósito**: Obtener estado actual del proyecto para contexto del AI.

```typescript
{
  name: 'prjct_get_state',
  description: 'Get current project state including active task, recent patterns, and learned preferences',
  inputSchema: z.object({
    project_id: z.string().uuid().optional()
      .describe('Project ID. If omitted, uses the project from current session')
  }),
  outputSchema: z.object({
    project: z.object({
      id: z.string().uuid(),
      name: z.string(),
      stack: z.array(z.string()),
      created_at: z.string().datetime()
    }),
    active_task: z.object({
      id: z.string().uuid(),
      title: z.string(),
      started_at: z.string().datetime(),
      duration_seconds: z.number()
    }).nullable(),
    recent_patterns: z.array(z.object({
      pattern: z.string(),
      frequency: z.number(),
      last_used: z.string().datetime()
    })).max(10),
    preferences: z.record(z.string(), z.string())
  })
}
```

**Ejemplo de uso por AI**:
```
AI: "Let me check the current project state before starting"
→ calls prjct_get_state()
→ receives: { project: {...}, active_task: null, patterns: [...] }
```

---

### 4.2 prjct_start_task

**Propósito**: Iniciar una tarea con tracking automático.

```typescript
{
  name: 'prjct_start_task',
  description: 'Start a new task. Automatically detects domain, loads relevant context, and syncs with Linear if connected.',
  inputSchema: z.object({
    title: z.string().min(1).max(200)
      .describe('Short description of the task'),
    description: z.string().max(2000).optional()
      .describe('Detailed description or acceptance criteria'),
    labels: z.array(z.string()).max(5).optional()
      .describe('Labels like "bug", "feature", "refactor"')
  }),
  outputSchema: z.object({
    task_id: z.string().uuid(),
    domain: z.enum(['frontend', 'backend', 'devops', 'testing', 'docs', 'general']),
    started_at: z.string().datetime(),
    context: z.object({
      relevant_patterns: z.number(),
      recent_decisions: z.number(),
      suggested_files: z.array(z.string())
    }),
    linear_issue: z.object({
      id: z.string(),
      identifier: z.string(),
      url: z.string()
    }).optional()
  })
}
```

**Ejemplo de uso**:
```
AI: "Starting work on authentication feature"
→ calls prjct_start_task({ title: "Implement JWT auth", labels: ["feature", "backend"] })
→ receives: { task_id: "...", domain: "backend", linear_issue: { identifier: "PRJ-42" } }
```

---

### 4.3 prjct_complete_task

**Propósito**: Completar tarea con outcome y aprendizajes.

```typescript
{
  name: 'prjct_complete_task',
  description: 'Mark a task as completed. Records outcome, duration, and any patterns learned.',
  inputSchema: z.object({
    task_id: z.string().uuid()
      .describe('The task ID to complete'),
    outcome: z.string().min(1).max(500)
      .describe('Summary of what was accomplished'),
    patterns_learned: z.array(z.string()).max(5).optional()
      .describe('New patterns or insights discovered during the task'),
    files_modified: z.array(z.string()).optional()
      .describe('List of files that were modified')
  }),
  outputSchema: z.object({
    completed: z.boolean(),
    duration_minutes: z.number(),
    patterns_saved: z.number(),
    linear_synced: z.boolean()
  })
}
```

---

### 4.4 prjct_pause_task / prjct_resume_task

**Propósito**: Pausar y resumir tareas para tracking de tiempo real.

```typescript
// Pause
{
  name: 'prjct_pause_task',
  description: 'Pause the current task. Use when switching context or taking a break.',
  inputSchema: z.object({
    task_id: z.string().uuid(),
    reason: z.string().max(200).optional()
  })
}

// Resume
{
  name: 'prjct_resume_task',
  description: 'Resume a paused task.',
  inputSchema: z.object({
    task_id: z.string().uuid()
  })
}
```

---

### 4.5 prjct_log_decision

**Propósito**: Registrar decisiones técnicas para referencia futura.

```typescript
{
  name: 'prjct_log_decision',
  description: 'Log a technical or architectural decision for future reference. Helps maintain consistency across sessions.',
  inputSchema: z.object({
    decision: z.string().min(1).max(200)
      .describe('The decision made'),
    context: z.string().max(500)
      .describe('Why this decision was needed'),
    alternatives: z.array(z.string()).max(5).optional()
      .describe('Other options that were considered'),
    rationale: z.string().max(1000)
      .describe('Why this option was chosen over alternatives')
  }),
  outputSchema: z.object({
    decision_id: z.string().uuid(),
    related_decisions: z.array(z.object({
      id: z.string().uuid(),
      decision: z.string(),
      created_at: z.string().datetime()
    })).max(3)
  })
}
```

**Ejemplo**:
```
AI: "I need to decide between REST and GraphQL"
→ calls prjct_log_decision({
    decision: "Use REST for API",
    context: "Choosing API architecture for user service",
    alternatives: ["GraphQL", "gRPC"],
    rationale: "Team more familiar with REST, simpler for CRUD operations"
  })
```

---

### 4.6 prjct_get_context

**Propósito**: Obtener contexto relevante para la tarea actual.

```typescript
{
  name: 'prjct_get_context',
  description: 'Get relevant context for the current task. Returns patterns, decisions, and preferences filtered by domain.',
  inputSchema: z.object({
    task_id: z.string().uuid().optional()
      .describe('Task to get context for. Defaults to active task'),
    include: z.array(z.enum(['patterns', 'decisions', 'preferences', 'files'])).optional()
      .describe('What to include in context. Defaults to all')
  }),
  outputSchema: z.object({
    domain: z.string(),
    patterns: z.array(z.object({
      pattern: z.string(),
      examples: z.array(z.string()),
      frequency: z.number()
    })),
    decisions: z.array(z.object({
      decision: z.string(),
      rationale: z.string(),
      created_at: z.string().datetime()
    })),
    preferences: z.record(z.string(), z.any()),
    suggested_files: z.array(z.string())
  })
}
```

---

### 4.7 prjct_linear_sync

**Propósito**: Sincronización bidireccional con Linear.

```typescript
{
  name: 'prjct_linear_sync',
  description: 'Sync tasks with Linear. Can push local changes, pull remote changes, or sync both directions.',
  inputSchema: z.object({
    direction: z.enum(['push', 'pull', 'both']).default('both')
      .describe('Sync direction'),
    task_id: z.string().uuid().optional()
      .describe('Specific task to sync. If omitted, syncs all pending')
  }),
  outputSchema: z.object({
    pushed: z.number(),
    pulled: z.number(),
    conflicts: z.array(z.object({
      task_id: z.string().uuid(),
      field: z.string(),
      local_value: z.string(),
      remote_value: z.string()
    }))
  })
}
```

---

## 5. Database Schema (Supabase)

```sql
-- Users (managed by Supabase Auth)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  tier text check (tier in ('free', 'pro', 'team')) default 'free',
  stripe_customer_id text,
  created_at timestamptz default now()
);

-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  stack jsonb default '[]',
  preferences jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text,
  status text check (status in ('active', 'paused', 'completed', 'shipped')) default 'active',
  domain text,
  labels text[] default '{}',
  outcome text,
  agent text, -- 'claude', 'cursor', 'windsurf', etc.
  started_at timestamptz default now(),
  paused_at timestamptz,
  completed_at timestamptz,
  duration_seconds int default 0,
  linear_issue_id text,
  created_at timestamptz default now()
);

-- Patterns (learned behaviors)
create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  pattern text not null,
  domain text,
  frequency int default 1,
  examples jsonb default '[]',
  last_used timestamptz default now(),
  created_at timestamptz default now()
);

-- Decisions (architectural/technical decisions)
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete set null,
  decision text not null,
  context text,
  alternatives text[],
  rationale text,
  created_at timestamptz default now()
);

-- Events (activity log for dashboard)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete set null,
  event_type text not null, -- 'task_started', 'task_completed', 'decision_logged', etc.
  payload jsonb default '{}',
  agent text,
  created_at timestamptz default now()
);

-- Integrations (Linear, GitHub, etc.)
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  provider text not null, -- 'linear', 'github'
  access_token text, -- encrypted
  refresh_token text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  unique(user_id, provider)
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.patterns enable row level security;
alter table public.decisions enable row level security;
alter table public.events enable row level security;
alter table public.integrations enable row level security;

-- Policies (user can only access own data)
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can view own projects"
  on public.projects for all
  using (auth.uid() = user_id);

-- (similar policies for other tables)

-- Indexes for performance
create index idx_tasks_project_status on public.tasks(project_id, status);
create index idx_events_project_created on public.events(project_id, created_at desc);
create index idx_patterns_project_domain on public.patterns(project_id, domain);
create index idx_decisions_project on public.decisions(project_id);

-- Realtime subscriptions
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.events;
```

---

## 6. Pricing Tiers

| Feature | Free | Pro ($8/mo) | Team ($12/seat/mo) |
|---------|------|-------------|---------------------|
| Projects | 3 | Unlimited | Unlimited |
| Tasks/month | 100 | Unlimited | Unlimited |
| Pattern history | 30 days | 1 year | Forever |
| Decision log | 30 days | 1 year | Forever |
| Linear sync | ✅ | ✅ | ✅ |
| Dashboard | Basic | Full | Full |
| Analytics | - | ✅ | ✅ |
| Team sharing | - | - | ✅ |
| Priority support | - | - | ✅ |
| API access | - | ✅ | ✅ |

**Límite técnico Free tier**: 3 proyectos max en Supabase. Al crear el 4to, prompt para upgrade.

---

## 7. Timeline de Implementación

### Semana 1: Foundation
- [ ] Setup proyecto TypeScript + MCP SDK
- [ ] Configurar Supabase (schema, RLS, realtime)
- [ ] Implementar auth middleware
- [ ] Deploy básico en Vercel

### Semana 2: Core Tools
- [ ] prjct_get_state
- [ ] prjct_start_task
- [ ] prjct_complete_task
- [ ] prjct_pause_task / prjct_resume_task
- [ ] Unit tests

### Semana 3: Advanced Tools + Integration
- [ ] prjct_log_decision
- [ ] prjct_get_context
- [ ] prjct_linear_sync
- [ ] Events pipeline para dashboard

### Semana 4: Polish + Launch Prep
- [ ] Rate limiting
- [ ] Error handling refinado
- [ ] Documentación de setup
- [ ] Testeo con Claude, Cursor, VS Code
- [ ] Dashboard MVP (view-only)

### Semana 5: Launch
- [ ] Public beta
- [ ] Landing page updates
- [ ] Monitoring + alertas
- [ ] Feedback loop

---

## 8. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| SDK v2 breaking changes | Media | Alto | Usar v1.x, tests comprehensivos |
| Latencia alta | Baja | Alto | Edge deploy, connection pooling |
| Adopción lenta | Media | Medio | Documentación clara, examples |
| Competencia copia | Baja | Bajo | Ejecutar rápido, feedback loop |

---

## 9. Out of Scope (v1)

- Mobile app
- Self-hosted option
- GitHub/GitLab sync (solo Linear en v1)
- Custom MCP tools por usuario
- AI model routing
- Billing/payments (manual por ahora)

---

## 10. Success Criteria

**Launch es exitoso si**:

1. ✅ Todos los 7 tools funcionan al 100%
2. ✅ Setup toma <5 minutos
3. ✅ Funciona en Claude Desktop + Cursor
4. ✅ Dashboard muestra actividad en tiempo real
5. ✅ 10 usuarios beta activos en primera semana

---

## Appendix: MCP Config para Usuarios

```json
// Claude Desktop: ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "prjct": {
      "url": "https://mcp.prjct.app",
      "headers": {
        "Authorization": "Bearer YOUR_JWT_TOKEN"
      }
    }
  }
}
```

```json
// Cursor: .cursor/mcp.json
{
  "servers": {
    "prjct": {
      "type": "http",
      "url": "https://mcp.prjct.app",
      "auth": {
        "type": "bearer",
        "token": "YOUR_JWT_TOKEN"
      }
    }
  }
}
```
