# Plan de Implementación: Python FastAPI Backend

> **Fecha**: 2025-12-11
> **Objetivo**: Migrar prjct-cli a un backend 100% cloud-based con Python
> **Actualizado**: OpenCode-style granular storage + incremental sync

---

## Resumen Ejecutivo

Migrar de Node.js a **Python FastAPI** con:
- **FastAPI + WebSockets** para comunicación real-time
- **PostgreSQL** para almacenamiento persistente
- **OpenCode-style granular storage** en CLI (JSON files individuales por entidad)
- **Sync incremental** solo en `/p:ship` y `/p:sync`
- **Autenticación multi-usuario** con GitHub OAuth + API keys
- **Deployment** en Railway/Render/Fly.io

### Decisiones Clave
| Decisión | Elección |
|----------|----------|
| Backend Repo | Separado: `prjct-api` |
| Frontend | Migrar Next.js → **Vue 3 + Vite + shadcn-vue** |
| CLI Storage | **Granular JSON** por entidad (patrón OpenCode) |
| Sync Strategy | **Incremental** solo en `/p:ship` y `/p:sync` |
| Claude Context | **MD files generados** desde JSON data |
| Base de datos | PostgreSQL (managed) |
| Cache/PubSub | Redis |

---

## NEW: CLI Storage Architecture (Patrón OpenCode)

### Problema Actual
- Archivos MD monolíticos crecen indefinidamente
- Claude recibe datos históricos innecesariamente
- Sync de proyecto completo = payload grande + alto costo de procesamiento
- Sessions no se utilizan correctamente

### Nueva Estructura
```
~/.prjct-cli/projects/{projectId}/
├── data/                           # JSON storage (source of truth)
│   ├── project.json                # Project metadata
│   ├── tasks/
│   │   ├── {taskId}.json           # Individual task
│   │   └── index.json              # Task index/queue
│   ├── features/
│   │   ├── {featureId}.json        # Individual feature
│   │   └── index.json              # Feature list
│   ├── ideas/
│   │   ├── {ideaId}.json           # Individual idea
│   │   └── index.json              # Idea list
│   ├── sessions/
│   │   └── {sessionId}.json        # Work session
│   ├── shipped/
│   │   └── {shipId}.json           # Shipped item
│   └── agents/
│       └── {agentName}.json        # Agent definition
│
├── context/                        # Generated for Claude
│   ├── CLAUDE.md                   # Full context file (auto-generated)
│   ├── now.md                      # Current task context
│   ├── queue.md                    # Task queue context
│   └── summary.md                  # Project summary
│
├── sync/                           # Sync state
│   ├── pending.json                # Events pending sync
│   ├── last-sync.json              # Last successful sync
│   └── conflict-log.json           # Sync conflicts
│
└── .prjct.config.json              # Local project config (unchanged)
```

### Path-Based Storage API
```typescript
// Storage interface (inspirado en OpenCode)
interface Storage {
  write<T>(path: string[], data: T): Promise<void>
  read<T>(path: string[]): Promise<T | null>
  list(prefix: string[]): Promise<string[][]>
  delete(path: string[]): Promise<void>
}

// Ejemplos:
await Storage.write(["task", taskId], taskData)        // data/tasks/{taskId}.json
await Storage.write(["feature", featureId], featureData)  // data/features/{featureId}.json
await Storage.read(["task", taskId])                   // Returns task or null
await Storage.list(["task"])                           // Returns all task paths
```

### Event Bus para Sync
```typescript
// Event types
type SyncEvent = {
  type: "task.created" | "task.updated" | "task.completed" |
        "feature.created" | "feature.shipped" |
        "idea.created" | "session.started" | "session.completed"
  path: string[]      // ["task", "abc123"]
  data: unknown       // The entity data
  timestamp: string   // ISO timestamp
}

// En cada write, publicar evento
Storage.write(path, data) {
  // 1. Write to disk
  await fs.writeFile(pathToFile(path), JSON.stringify(data))

  // 2. Publish event (stored in pending.json)
  Bus.publish({ type: inferEventType(path), path, data, timestamp: now() })
}

// Events se acumulan en pending.json hasta /p:ship o /p:sync
```

### Flujo de Sync (Incremental)
```
/p:ship o /p:sync triggered
       │
       ▼
┌──────────────────────┐
│ Read pending.json    │  ← Events desde último sync
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ POST /sync/batch     │  ← Solo entidades modificadas
│ {                    │
│   project_id: "...", │
│   events: [...]      │
│ }                    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Clear pending.json   │
│ Update last-sync.json│
└──────────────────────┘
```

---

## Arquitectura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   CLI (local)   │────>│  FastAPI Backend │<───>│  PostgreSQL │
│   prjct-cli     │     │  (Railway)       │     │  (managed)  │
│                 │     │                  │     │             │
│ ┌─────────────┐ │     │                  │     │             │
│ │ data/*.json │─┼─────┼──► /sync/batch   │     │             │
│ └─────────────┘ │     │                  │     │             │
│ ┌─────────────┐ │     │                  │     │             │
│ │context/*.md │ │     │                  │     │             │
│ └─────────────┘ │     └────────┬─────────┘     └─────────────┘
└─────────────────┘              │
                                 │
┌─────────────────┐              │              ┌─────────────┐
│   Web Dashboard │──WebSocket───┤              │    Redis    │
│   (Vue 3+Vite)  │              │              │  (pub/sub)  │
└─────────────────┘              └──────────────┴─────────────┘
```

### Data Flow
1. **CLI writes** → `data/*.json` (granular)
2. **CLI generates** → `context/*.md` (for Claude)
3. **On /p:ship** → `POST /sync/batch` (incremental)
4. **API stores** → PostgreSQL
5. **API broadcasts** → Redis pub/sub → Web Dashboard

---

## Estructura del Proyecto

### Nuevo Repo: prjct-api/

```
prjct-api/
├── main.py                      # FastAPI entry point
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── alembic.ini
├── alembic/                     # DB migrations
│   ├── env.py
│   └── versions/
│       └── 001_initial.py
├── app/
│   ├── __init__.py
│   ├── config.py                # Settings (Pydantic BaseSettings)
│   ├── database.py              # PostgreSQL async connection
│   ├── redis.py                 # Redis async connection
│   │
│   ├── models/                  # SQLAlchemy 2.0 models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── project.py
│   │   ├── task.py
│   │   ├── feature.py
│   │   ├── idea.py
│   │   ├── session.py
│   │   ├── shipped.py
│   │   ├── agent.py
│   │   └── activity.py
│   │
│   ├── schemas/                 # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── project.py
│   │   ├── task.py
│   │   ├── feature.py
│   │   ├── idea.py
│   │   ├── session.py
│   │   ├── events.py
│   │   └── validators.py
│   │
│   ├── routers/                 # API routes
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── projects.py
│   │   ├── tasks.py
│   │   ├── features.py
│   │   ├── ideas.py
│   │   ├── sessions.py
│   │   ├── stats.py
│   │   ├── sync.py
│   │   ├── websocket.py
│   │   └── health.py
│   │
│   ├── services/                # Business logic
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── project.py
│   │   ├── task.py
│   │   ├── stats.py
│   │   ├── momentum.py
│   │   └── migration.py
│   │
│   ├── core/                    # Core utilities
│   │   ├── __init__.py
│   │   ├── security.py          # JWT, password hashing
│   │   ├── permissions.py       # Role-based access
│   │   ├── websocket_manager.py # Real-time sync
│   │   ├── pty_manager.py       # Terminal sessions
│   │   ├── rate_limit.py
│   │   └── exceptions.py
│   │
│   ├── pty/                     # PTY implementation
│   │   ├── __init__.py
│   │   ├── manager.py           # PTYSessionManager
│   │   ├── session.py           # PTYSession dataclass
│   │   └── buffer.py            # OutputBuffer (16ms batching)
│   │
│   ├── storage/                 # Session storage
│   │   ├── __init__.py
│   │   ├── base.py              # Abstract SessionStorage
│   │   ├── memory.py            # InMemoryStorage
│   │   └── redis.py             # RedisStorage
│   │
│   └── middleware/
│       ├── __init__.py
│       └── security.py          # HTTPS redirect, etc.
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_projects.py
│   ├── test_tasks.py
│   ├── test_websocket.py
│   └── test_pty.py
│
└── scripts/
    ├── migrate_from_files.py   # One-time migration
    └── seed_data.py
```

### Nuevo Repo: prjct-web/ (Vue 3 SPA)

```
prjct-web/
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig.json
├── components.json              # shadcn-vue config
├── src/
│   ├── App.vue
│   ├── main.ts
│   ├── api/
│   │   ├── client.ts           # Axios/fetch wrapper
│   │   └── endpoints.ts
│   ├── composables/            # Vue composables (como hooks)
│   │   ├── useApi.ts
│   │   ├── useAuth.ts
│   │   ├── useProjects.ts
│   │   ├── useTerminal.ts
│   │   └── useWebSocket.ts
│   ├── components/
│   │   ├── ui/                 # shadcn-vue components
│   │   │   ├── button/
│   │   │   ├── card/
│   │   │   ├── dialog/
│   │   │   └── ...
│   │   ├── HeroSection.vue
│   │   ├── NowCard.vue
│   │   ├── QueueCard.vue
│   │   ├── TerminalDock.vue
│   │   └── ... (portados de packages/web)
│   ├── views/                  # Pages/Routes
│   │   ├── Dashboard.vue
│   │   ├── Project.vue
│   │   ├── Login.vue
│   │   └── Settings.vue
│   ├── stores/                 # Pinia stores
│   │   ├── auth.ts
│   │   ├── projects.ts
│   │   └── terminal.ts
│   ├── router/
│   │   └── index.ts            # Vue Router config
│   └── lib/
│       └── utils.ts            # cn() helper para shadcn
└── public/
```

**Stack Vue 3:**
- **Vue 3** + Composition API + `<script setup>`
- **Vite** (build tool)
- **Vue Router 4** (routing)
- **Pinia** (state management)
- **shadcn-vue** (UI components)
- **VueUse** (utilities/composables)
- **xterm.js** (terminal - vanilla JS)

---

## Schema de Base de Datos (PostgreSQL)

### Tabla: users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    github_id VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),  -- Nullable for OAuth users

    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_github_id ON users(github_id);
```

### Tabla: api_keys

```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    key_prefix VARCHAR(20) NOT NULL,        -- "prjct_live_abc..."
    key_hash VARCHAR(255) NOT NULL,         -- bcrypt hash
    name VARCHAR(100) NOT NULL,             -- "MacBook Pro"
    scopes TEXT[] DEFAULT ARRAY['read', 'write'],

    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
```

### Tabla: refresh_tokens

```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    token_hash VARCHAR(255) NOT NULL UNIQUE,
    device_info VARCHAR(500),

    is_revoked BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: projects

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id VARCHAR(12) UNIQUE NOT NULL,   -- "3a5667a5dedb" (from prjct-cli)

    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    repo_path TEXT,                         -- Local path for PTY
    repo_url TEXT,                          -- GitHub URL

    tech_stack TEXT[] DEFAULT '{}',

    file_count INTEGER DEFAULT 0,
    commit_count INTEGER DEFAULT 0,
    version VARCHAR(50),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,

    is_archived BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_projects_local_id ON projects(local_id);
CREATE INDEX idx_projects_slug ON projects(slug);
```

### Tabla: project_members

```sql
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'collaborator', 'viewer');

CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    role member_role NOT NULL DEFAULT 'viewer',

    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, user_id)
);

CREATE INDEX idx_members_project ON project_members(project_id);
CREATE INDEX idx_members_user ON project_members(user_id);
```

### Tabla: tasks

```sql
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'paused', 'completed', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    feature_id UUID REFERENCES features(id) ON DELETE SET NULL,

    description TEXT NOT NULL,
    status task_status DEFAULT 'pending',
    priority task_priority DEFAULT 'medium',

    agent_name VARCHAR(100),
    session_id VARCHAR(50),

    estimate_seconds INTEGER,
    actual_seconds INTEGER,
    accuracy_percent DECIMAL(5,2),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    files_changed INTEGER DEFAULT 0,
    lines_added INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    commits_count INTEGER DEFAULT 0,

    queue_position INTEGER
);

CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_feature ON tasks(feature_id);
```

### Tabla: features

```sql
CREATE TYPE feature_status AS ENUM ('planned', 'in_progress', 'completed', 'shipped', 'archived');

CREATE TABLE features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,
    status feature_status DEFAULT 'planned',

    phase_number INTEGER DEFAULT 1,
    phase_name VARCHAR(100),

    estimated_effort VARCHAR(50),
    actual_effort VARCHAR(50),

    impact VARCHAR(50),     -- high, medium, low
    effort VARCHAR(50),     -- high, medium, low
    priority_score INTEGER,

    progress INTEGER DEFAULT 0,  -- 0-100

    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,

    version VARCHAR(50),
    sort_order INTEGER
);

CREATE INDEX idx_features_project ON features(project_id);
CREATE INDEX idx_features_status ON features(status);
```

### Tabla: ideas

```sql
CREATE TYPE idea_status AS ENUM ('pending', 'reviewing', 'planned', 'rejected', 'implemented');

CREATE TABLE ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    title VARCHAR(500) NOT NULL,
    description TEXT,

    status idea_status DEFAULT 'pending',

    impact VARCHAR(50),
    effort VARCHAR(50),
    priority_score INTEGER,

    pain_points TEXT[],
    proposed_solutions TEXT[],

    converted_to_feature_id UUID REFERENCES features(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    implemented_at TIMESTAMPTZ
);

CREATE INDEX idx_ideas_project ON ideas(project_id);
CREATE INDEX idx_ideas_status ON ideas(status);
```

### Tabla: sessions

```sql
CREATE TYPE session_status AS ENUM ('active', 'paused', 'completed', 'abandoned');

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    session_code VARCHAR(50) NOT NULL,      -- "sess_abc12345"
    task_description TEXT NOT NULL,
    status session_status DEFAULT 'active',

    original_prompt TEXT,
    relevant_files TEXT[],

    started_at TIMESTAMPTZ DEFAULT NOW(),
    paused_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,

    estimate_seconds INTEGER,
    accuracy_percent DECIMAL(5,2),

    files_changed INTEGER DEFAULT 0,
    lines_added INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    commits_count INTEGER DEFAULT 0,

    snapshot_hashes TEXT[]
);

CREATE INDEX idx_sessions_project ON sessions(project_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_status ON sessions(status);
```

### Tabla: shipped_items

```sql
CREATE TYPE ship_outcome AS ENUM ('validated', 'monitoring', 'known_issues', 'reverted');

CREATE TABLE shipped_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    feature_id UUID REFERENCES features(id) ON DELETE SET NULL,

    name VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    commit_hash VARCHAR(50),

    outcome ship_outcome DEFAULT 'monitoring',
    outcome_notes TEXT,

    lint_status VARCHAR(50),
    test_status VARCHAR(50),

    changes_summary TEXT[],
    files_changed INTEGER,
    lines_added INTEGER,
    lines_removed INTEGER,

    shipped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shipped_project ON shipped_items(project_id);
CREATE INDEX idx_shipped_date ON shipped_items(shipped_at DESC);
```

### Tabla: agents

```sql
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    role VARCHAR(255),
    description TEXT,

    responsibilities TEXT[],
    when_to_use TEXT[],
    best_for TEXT[],
    avoid_for TEXT[],

    tasks_completed INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0,
    avg_duration_seconds INTEGER,
    estimate_accuracy DECIMAL(5,2),
    is_improving BOOLEAN DEFAULT FALSE,

    content_md TEXT,        -- Full agent .md content

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, name)
);

CREATE INDEX idx_agents_project ON agents(project_id);
```

### Tabla: sync_events (NEW - Append-Only Event Log)

```sql
-- Append-only event log (como pending.json del CLI pero permanente)
CREATE TABLE sync_events (
    id BIGSERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    event_type VARCHAR(50) NOT NULL,  -- "task.created", "feature.shipped", etc.
    entity_path TEXT[] NOT NULL,       -- ["task", "abc123"]
    entity_data JSONB NOT NULL,        -- Full entity at time of sync

    client_timestamp TIMESTAMPTZ NOT NULL,
    server_timestamp TIMESTAMPTZ DEFAULT NOW(),

    -- For conflict resolution
    version INTEGER DEFAULT 1,
    supersedes BIGINT REFERENCES sync_events(id)
);

CREATE INDEX idx_sync_project ON sync_events(project_id);
CREATE INDEX idx_sync_type ON sync_events(event_type);
CREATE INDEX idx_sync_path ON sync_events USING GIN(entity_path);
CREATE INDEX idx_sync_timestamp ON sync_events(server_timestamp DESC);
```

### Tabla: activity_logs

```sql
CREATE TABLE activity_logs (
    id BIGSERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    event_type VARCHAR(100) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),

    data JSONB DEFAULT '{}',

    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    feature_id UUID REFERENCES features(id) ON DELETE SET NULL
);

CREATE INDEX idx_activity_project ON activity_logs(project_id);
CREATE INDEX idx_activity_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX idx_activity_type ON activity_logs(event_type);
CREATE INDEX idx_activity_data ON activity_logs USING GIN(data);
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/auth/github` | Redirect a GitHub OAuth |
| GET | `/auth/github/callback` | Callback de OAuth |
| POST | `/auth/token` | Login email/password |
| POST | `/auth/token/refresh` | Refrescar JWT |
| POST | `/auth/logout` | Revocar refresh token |
| POST | `/auth/api-keys` | Crear API key (CLI) |
| GET | `/auth/api-keys` | Listar API keys |
| DELETE | `/auth/api-keys/{id}` | Revocar API key |

### Sync (NEW - Incremental)

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/sync/batch` | **Batch sync desde CLI** - Body: `{ project_id, events: SyncEvent[] }` |
| POST | `/sync/pull` | **Pull updates para CLI** - Body: `{ project_id, since: timestamp }` |
| GET | `/sync/status/{project_id}` | Estado de sync: `{ last_sync, pending_count, conflicts }` |

### Users

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/users/me` | Perfil actual |
| PATCH | `/users/me` | Actualizar perfil |
| DELETE | `/users/me` | Eliminar cuenta |

### Projects

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/projects` | Listar proyectos |
| POST | `/projects` | Crear proyecto (from CLI first sync) |
| GET | `/projects/{id}` | Obtener proyecto |
| PATCH | `/projects/{id}` | Actualizar proyecto |
| DELETE | `/projects/{id}` | Archivar proyecto |
| GET | `/projects/{id}/stats` | Estadísticas |
| GET | `/projects/{id}/momentum` | Datos sparkline |
| GET | `/projects/{id}/status` | Estado actual |

### Project Collaborators

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/projects/{id}/collaborators` | Listar colaboradores |
| POST | `/projects/{id}/collaborators` | Invitar |
| PATCH | `/projects/{id}/collaborators/{uid}` | Cambiar rol |
| DELETE | `/projects/{id}/collaborators/{uid}` | Remover |

### Tasks

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/projects/{id}/tasks` | Listar tasks |
| POST | `/projects/{id}/tasks` | Crear task |
| GET | `/projects/{id}/tasks/{tid}` | Obtener task |
| PATCH | `/projects/{id}/tasks/{tid}` | Actualizar task |
| DELETE | `/projects/{id}/tasks/{tid}` | Eliminar task |
| POST | `/projects/{id}/tasks/{tid}/start` | `/p:now` |
| POST | `/projects/{id}/tasks/{tid}/pause` | `/p:pause` |
| POST | `/projects/{id}/tasks/{tid}/resume` | `/p:resume` |
| POST | `/projects/{id}/tasks/{tid}/complete` | `/p:done` |
| PATCH | `/projects/{id}/tasks/reorder` | Reordenar cola |

### Features

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/projects/{id}/features` | Listar features |
| POST | `/projects/{id}/features` | Crear feature |
| GET | `/projects/{id}/features/{fid}` | Obtener feature |
| PATCH | `/projects/{id}/features/{fid}` | Actualizar |
| DELETE | `/projects/{id}/features/{fid}` | Eliminar |
| POST | `/projects/{id}/features/{fid}/ship` | `/p:ship` |

### Ideas

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/projects/{id}/ideas` | Listar ideas |
| POST | `/projects/{id}/ideas` | Crear idea (`/p:idea`) |
| GET | `/projects/{id}/ideas/{iid}` | Obtener idea |
| PATCH | `/projects/{id}/ideas/{iid}` | Actualizar |
| DELETE | `/projects/{id}/ideas/{iid}` | Eliminar |
| POST | `/projects/{id}/ideas/{iid}/convert` | Convertir a feature |

### Sessions

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/projects/{id}/sessions` | Listar sesiones |
| GET | `/projects/{id}/sessions/current` | Sesión actual |
| GET | `/projects/{id}/sessions/{sid}` | Obtener sesión |

### Agents

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/projects/{id}/agents` | Listar agents |
| POST | `/projects/{id}/agents` | Crear/regenerar |
| GET | `/projects/{id}/agents/{name}` | Obtener agent |
| PATCH | `/projects/{id}/agents/{name}` | Actualizar |
| DELETE | `/projects/{id}/agents/{name}` | Eliminar |

### Activity & Stats

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/projects/{id}/activity` | Log de actividad |
| GET | `/sessions/history` | Historial agregado |

### WebSocket

| Protocol | Endpoint | Descripción |
|----------|----------|-------------|
| WS | `/ws/terminal/{project_id}` | PTY terminal |
| WS | `/ws/projects/{project_id}` | Updates real-time |

### Health

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Health check básico |
| GET | `/health/ready` | Readiness (DB + Redis) |

---

## Implementación WebSocket

### Protocolo PTY Terminal

```typescript
// Client → Server
{ type: 'input', data: string }
{ type: 'resize', cols: number, rows: number }

// Server → Client
{ type: 'connected', sessionId: string }
{ type: 'output', data: string }
{ type: 'exit', code: number }
{ type: 'error', message: string }
{ type: 'ping' }
```

### PTY Manager (Python)

```python
# app/pty/manager.py

import os
import asyncio
from typing import Dict, Callable
from ptyprocess import PtyProcess

class PTYSessionManager:
    def __init__(self, storage: "SessionStorage"):
        self._storage = storage
        self._processes: Dict[str, PtyProcess] = {}
        self._data_handlers: Dict[str, Callable[[str], None]] = {}
        self._exit_handlers: Dict[str, Callable[[int], None]] = {}

    async def create_session(
        self,
        session_id: str,
        project_dir: str
    ) -> tuple[PtyProcess, bool]:
        """Create or reuse PTY session."""

        existing = self._processes.get(session_id)
        if existing and existing.isalive():
            return existing, False

        shell = os.environ.get('SHELL', '/bin/bash')
        env = {
            **os.environ,
            'TERM': 'xterm-256color',
            'COLORTERM': 'truecolor',
        }

        process = PtyProcess.spawn(
            [shell, '-l', '-i'],
            cwd=project_dir,
            env=env,
            dimensions=(30, 120)
        )

        self._processes[session_id] = process

        # Register with asyncio event loop
        loop = asyncio.get_event_loop()
        loop.add_reader(process.fd, self._on_pty_data, session_id)

        return process, True

    def write(self, session_id: str, data: str):
        process = self._processes.get(session_id)
        if process and process.isalive():
            process.write(data)

    def resize(self, session_id: str, cols: int, rows: int):
        process = self._processes.get(session_id)
        if process:
            process.setwinsize(rows, cols)

    def kill_session(self, session_id: str):
        process = self._processes.pop(session_id, None)
        if process:
            loop = asyncio.get_event_loop()
            try:
                loop.remove_reader(process.fd)
            except:
                pass
            if process.isalive():
                process.terminate()
```

### Output Buffer (16ms batching)

```python
# app/pty/buffer.py

import asyncio
from typing import Callable, List

class OutputBuffer:
    """Batches PTY output at 16ms intervals (60fps)."""

    BATCH_MS = 0.016  # 16 milliseconds

    def __init__(self, flush_callback: Callable[[str], None]):
        self._buffer: List[str] = []
        self._flush_callback = flush_callback
        self._flush_task: asyncio.Task | None = None
        self._lock = asyncio.Lock()

    async def append(self, data: str):
        async with self._lock:
            self._buffer.append(data)
            if self._flush_task is None:
                self._flush_task = asyncio.create_task(self._schedule_flush())

    async def _schedule_flush(self):
        await asyncio.sleep(self.BATCH_MS)
        await self.flush()

    async def flush(self):
        async with self._lock:
            if self._buffer:
                combined = ''.join(self._buffer)
                self._buffer.clear()
                self._flush_callback(combined)
            self._flush_task = None
```

### WebSocket Handler

```python
# app/routers/websocket.py

from fastapi import WebSocket, WebSocketDisconnect
from app.pty.manager import PTYSessionManager
from app.pty.buffer import OutputBuffer

async def terminal_websocket(
    websocket: WebSocket,
    project_id: str,
    pty_manager: PTYSessionManager
):
    await websocket.accept()

    session_id = f"pty_{project_id}_{uuid.uuid4().hex[:8]}"

    # Create output buffer
    def send_output(data: str):
        asyncio.create_task(
            websocket.send_json({"type": "output", "data": data})
        )
    buffer = OutputBuffer(send_output)

    # Create PTY session
    process, is_new = await pty_manager.create_session(session_id, project_dir)

    # Register handlers
    def on_data(data: str):
        asyncio.create_task(buffer.append(data))

    pty_manager.register_data_handler(session_id, on_data)

    # Send connected message
    await websocket.send_json({"type": "connected", "sessionId": session_id})

    # Auto-start Claude CLI
    if is_new:
        await asyncio.sleep(0.2)
        pty_manager.write(session_id, 'claude\r')

    # Message loop
    try:
        while True:
            data = await websocket.receive_json()
            if data["type"] == "input":
                pty_manager.write(session_id, data["data"])
            elif data["type"] == "resize":
                pty_manager.resize(session_id, data["cols"], data["rows"])
    except WebSocketDisconnect:
        pty_manager.kill_session(session_id)
```

---

## Sistema de Autenticación

### JWT Configuration

```python
# app/core/security.py

from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "access"},
        SECRET_KEY,
        algorithm=ALGORITHM
    )

def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "refresh"},
        SECRET_KEY,
        algorithm=ALGORITHM
    )

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)
```

### API Key Format

```
prjct_live_<32_random_chars>   # Production
prjct_test_<32_random_chars>   # Development
```

### GitHub OAuth Flow

```python
# app/routers/auth.py

from fastapi import APIRouter
from httpx import AsyncClient

router = APIRouter(prefix="/auth", tags=["auth"])

GITHUB_CLIENT_ID = "..."
GITHUB_CLIENT_SECRET = "..."

@router.get("/github")
async def github_login(callback_url: str = None, cli: bool = False):
    """Redirect to GitHub OAuth"""
    state = create_state(callback_url, cli)
    return RedirectResponse(
        f"https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={settings.GITHUB_CALLBACK_URL}"
        f"&scope=user:email"
        f"&state={state}"
    )

@router.get("/github/callback")
async def github_callback(code: str, state: str):
    """Handle GitHub OAuth callback"""
    async with AsyncClient() as client:
        # Exchange code for token
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"}
        )
        access_token = token_resp.json()["access_token"]

        # Get user info
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        github_user = user_resp.json()

        # Create or update user
        user = await get_or_create_user(github_user)

        # Return tokens
        return TokenResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
            token_type="bearer"
        )
```

### CLI Auth Storage

```json
// ~/.prjct-cli/auth.json
{
    "version": 1,
    "api_key": "prjct_live_xxx...",
    "api_key_name": "MacBook Pro",
    "api_key_id": "uuid...",
    "user_id": "uuid...",
    "email": "user@example.com",
    "username": "jj",
    "api_url": "https://api.prjct.app",
    "created_at": "2025-12-11T00:00:00Z",
    "expires_at": "2026-03-11T00:00:00Z"
}
```

---

## Sistema de Permisos

```python
# app/core/permissions.py

from enum import Enum
from typing import Set

class Permission(str, Enum):
    PROJECT_READ = "project:read"
    PROJECT_WRITE = "project:write"
    PROJECT_DELETE = "project:delete"
    PROJECT_MANAGE_MEMBERS = "project:manage_members"

    TASK_READ = "task:read"
    TASK_CREATE = "task:create"
    TASK_UPDATE = "task:update"
    TASK_DELETE = "task:delete"

    FEATURE_READ = "feature:read"
    FEATURE_CREATE = "feature:create"
    FEATURE_SHIP = "feature:ship"

    IDEA_READ = "idea:read"
    IDEA_CREATE = "idea:create"
    IDEA_DELETE = "idea:delete"

ROLE_PERMISSIONS: dict[str, Set[Permission]] = {
    "owner": set(Permission),  # All permissions
    "admin": {
        Permission.PROJECT_READ, Permission.PROJECT_WRITE,
        Permission.PROJECT_MANAGE_MEMBERS,
        Permission.TASK_READ, Permission.TASK_CREATE,
        Permission.TASK_UPDATE, Permission.TASK_DELETE,
        Permission.FEATURE_READ, Permission.FEATURE_CREATE,
        Permission.FEATURE_SHIP,
        Permission.IDEA_READ, Permission.IDEA_CREATE,
        Permission.IDEA_DELETE,
    },
    "collaborator": {
        Permission.PROJECT_READ, Permission.PROJECT_WRITE,
        Permission.TASK_READ, Permission.TASK_CREATE,
        Permission.TASK_UPDATE,
        Permission.FEATURE_READ, Permission.FEATURE_CREATE,
        Permission.IDEA_READ, Permission.IDEA_CREATE,
    },
    "viewer": {
        Permission.PROJECT_READ,
        Permission.TASK_READ,
        Permission.FEATURE_READ,
        Permission.IDEA_READ,
    },
}
```

---

## Real-Time Sync (Redis Pub/Sub)

### WebSocket Manager

```python
# app/core/websocket_manager.py

import asyncio
import json
from typing import Dict, Set
from fastapi import WebSocket
import redis.asyncio as redis

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.redis: redis.Redis = None

    async def init_redis(self, redis_url: str):
        self.redis = redis.from_url(redis_url)
        asyncio.create_task(self._redis_subscriber())

    async def connect(self, websocket: WebSocket, project_id: str, user_id: str):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = set()
        self.active_connections[project_id].add(websocket)

        await self.broadcast(project_id, {
            "type": "user_joined",
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        })

    async def broadcast(self, project_id: str, message: dict):
        """Broadcast to all pods via Redis"""
        channel = f"prjct:project:{project_id}"
        await self.redis.publish(channel, json.dumps(message))

    async def _redis_subscriber(self):
        """Listen for messages from other pods"""
        pubsub = self.redis.pubsub()
        await pubsub.psubscribe("prjct:project:*")

        async for message in pubsub.listen():
            if message["type"] == "pmessage":
                project_id = message["channel"].decode().split(":")[-1]
                data = json.loads(message["data"])
                await self._broadcast_local(project_id, data)

    async def _broadcast_local(self, project_id: str, message: dict):
        connections = self.active_connections.get(project_id, set())
        for websocket in connections:
            try:
                await websocket.send_json(message)
            except:
                pass
```

### Event Types

```python
# app/schemas/events.py

from pydantic import BaseModel
from typing import Literal, Optional

class TaskStartedEvent(BaseModel):
    type: Literal["task_started"] = "task_started"
    project_id: str
    task_id: str
    description: str
    user_id: str
    timestamp: datetime

class TaskCompletedEvent(BaseModel):
    type: Literal["task_completed"] = "task_completed"
    project_id: str
    task_id: str
    duration: str
    user_id: str
    timestamp: datetime

class FeatureShippedEvent(BaseModel):
    type: Literal["feature_shipped"] = "feature_shipped"
    project_id: str
    feature_id: str
    feature_name: str
    version: Optional[str]
    user_id: str
    timestamp: datetime

class IdeaCapturedEvent(BaseModel):
    type: Literal["idea_captured"] = "idea_captured"
    project_id: str
    idea_id: str
    content: str
    user_id: str
    timestamp: datetime
```

---

## Deployment

### Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for PTY
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    bash \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create non-root user for PTY
RUN useradd -m -s /bin/bash appuser && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')"

# Run with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://prjct:secret@db:5432/prjct
      - REDIS_URL=redis://redis:6379
      - SECRET_KEY=${SECRET_KEY}
      - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=prjct
      - POSTGRES_PASSWORD=secret
      - POSTGRES_DB=prjct

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

### requirements.txt

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy[asyncio]==2.0.25
asyncpg==0.29.0
alembic==1.13.1
redis==5.0.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
httpx==0.26.0
ptyprocess==0.7.0
python-multipart==0.0.6
pydantic==2.5.3
pydantic-settings==2.1.0
slowapi==0.1.9
```

### Railway Configuration

```toml
# railway.toml
[build]
builder = "dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/prjct
REDIS_URL=redis://default:password@host:6379
SECRET_KEY=your-256-bit-secret-key

# GitHub OAuth
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GITHUB_CALLBACK_URL=https://api.prjct.app/auth/github/callback

# JWT
JWT_SECRET_KEY=jwt-secret-min-32-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# API Keys
API_KEY_EXPIRE_DAYS=90

# Optional
ENVIRONMENT=production
LOG_LEVEL=INFO
CORS_ORIGINS=https://prjct.app,https://www.prjct.app
RATE_LIMIT_PER_MINUTE=60
```

---

## Data Migration Script

```python
# scripts/migrate_from_files.py
"""
Migration script to import file-based prjct data into PostgreSQL.

Usage:
    python scripts/migrate_from_files.py --user-email user@example.com
"""

import os
import json
import asyncio
from pathlib import Path
from datetime import datetime

PRJCT_DIR = Path.home() / ".prjct-cli" / "projects"

async def migrate_project(project_id: str, user_id: str, db):
    project_path = PRJCT_DIR / project_id

    # 1. Read project.json
    project_json = project_path / "project.json"
    if project_json.exists():
        with open(project_json) as f:
            data = json.load(f)

        project = await db.execute(
            insert(Project).values(
                local_id=project_id,
                name=data.get("name"),
                repo_path=data.get("repoPath"),
                tech_stack=data.get("techStack", []),
                version=data.get("version"),
            ).returning(Project.id)
        )
        project_db_id = project.scalar()

        # Link owner
        await db.execute(
            insert(ProjectMember).values(
                project_id=project_db_id,
                user_id=user_id,
                role="owner"
            )
        )

    # 2. Read core/now.md → current task
    now_md = project_path / "core" / "now.md"
    if now_md.exists():
        content = now_md.read_text()
        if content.strip():
            await db.execute(
                insert(Task).values(
                    project_id=project_db_id,
                    description=extract_task_from_md(content),
                    status="in_progress",
                    started_at=datetime.utcnow()
                )
            )

    # 3. Read core/next.md → task queue
    next_md = project_path / "core" / "next.md"
    if next_md.exists():
        tasks = parse_next_md(next_md.read_text())
        for i, task in enumerate(tasks):
            await db.execute(
                insert(Task).values(
                    project_id=project_db_id,
                    description=task["description"],
                    status="pending",
                    priority=task.get("priority", "medium"),
                    queue_position=i
                )
            )

    # 4. Read planning/ideas.md → ideas
    ideas_md = project_path / "planning" / "ideas.md"
    if ideas_md.exists():
        ideas = parse_ideas_md(ideas_md.read_text())
        for idea in ideas:
            await db.execute(
                insert(Idea).values(
                    project_id=project_db_id,
                    title=idea["title"],
                    description=idea.get("description"),
                    status="pending"
                )
            )

    # 5. Read planning/roadmap.md → features
    roadmap_md = project_path / "planning" / "roadmap.md"
    if roadmap_md.exists():
        features = parse_roadmap_md(roadmap_md.read_text())
        for feature in features:
            await db.execute(
                insert(Feature).values(
                    project_id=project_db_id,
                    name=feature["name"],
                    status=feature.get("status", "planned"),
                    phase_name=feature.get("phase")
                )
            )

    # 6. Read progress/shipped.md → shipped_items
    shipped_md = project_path / "progress" / "shipped.md"
    if shipped_md.exists():
        shipped = parse_shipped_md(shipped_md.read_text())
        for item in shipped:
            await db.execute(
                insert(ShippedItem).values(
                    project_id=project_db_id,
                    name=item["name"],
                    version=item.get("version"),
                    shipped_at=item.get("date")
                )
            )

    # 7. Read memory/context.jsonl → activity_logs
    context_jsonl = project_path / "memory" / "context.jsonl"
    if context_jsonl.exists():
        with open(context_jsonl) as f:
            for line in f:
                if line.strip():
                    event = json.loads(line)
                    await db.execute(
                        insert(ActivityLog).values(
                            project_id=project_db_id,
                            user_id=user_id,
                            event_type=event.get("type"),
                            timestamp=event.get("ts"),
                            data=event
                        )
                    )

    # 8. Read agents/*.md → agents
    agents_dir = project_path / "agents"
    if agents_dir.exists():
        for agent_file in agents_dir.glob("*.md"):
            content = agent_file.read_text()
            name = agent_file.stem
            await db.execute(
                insert(Agent).values(
                    project_id=project_db_id,
                    name=name,
                    content_md=content
                )
            )

    print(f"✅ Migrated project: {project_id}")

async def main():
    # Connect to database
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        # Get or create user
        user = await get_user_by_email(args.user_email)

        # Migrate all projects
        for project_dir in PRJCT_DIR.iterdir():
            if project_dir.is_dir():
                await migrate_project(project_dir.name, user.id, conn)

    print("🎉 Migration complete!")

if __name__ == "__main__":
    asyncio.run(main())
```

---

## CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy API

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: prjct_test
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: pip install -r requirements.txt pytest pytest-asyncio httpx

      - name: Run tests
        env:
          DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/prjct_test
          REDIS_URL: redis://localhost:6379
        run: pytest --tb=short

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: prjct-api
```

---

## Fases de Implementación (MVP Paralelo)

### Stream A: CLI Storage Refactor (FIRST PRIORITY)
- [ ] Crear Storage interface (`core/storage/`)
- [ ] Implementar file-based path storage
- [ ] Crear Event Bus (`core/events/`)
- [ ] Migrar data existente a nuevo formato
- [ ] Actualizar todos los comandos /p:* para usar Storage
- [ ] Implementar generación de contexto (`core/context/`)
- [ ] Zod schemas en `packages/shared/schemas/`

### Stream B: Backend Core
- [ ] Crear repo `prjct-api` con estructura FastAPI
- [ ] Modelos PostgreSQL + migraciones Alembic
- [ ] `/sync/batch` endpoint (sync incremental)
- [ ] GitHub OAuth + JWT + API key authentication
- [ ] Endpoints CRUD básicos para entidades

### Stream C: Sync Integration
- [ ] CLI: Sync client (`core/sync/`)
- [ ] CLI: Comando `prjct login`
- [ ] CLI: Hook sync en /p:ship y /p:sync
- [ ] Detección y resolución de conflictos
- [ ] Cola offline con retry

### Stream D: PTY & WebSockets
- [ ] Integración ptyprocess con asyncio
- [ ] WebSocket handler para terminal
- [ ] Output buffering (16ms batches)
- [ ] Persistencia de sesiones en Redis
- [ ] Real-time updates para proyectos

### Stream E: Frontend Migration (Vue 3 + shadcn-vue)
- [ ] Crear proyecto Vue 3 + Vite + TypeScript
- [ ] Instalar y configurar shadcn-vue
- [ ] Configurar Vue Router 4 + Pinia stores
- [ ] Portar componentes a .vue (HeroSection, NowCard, etc.)
- [ ] Conectar con Python API
- [ ] xterm.js con WebSocket

### Stream F: Deployment
- [ ] Dockerfile + docker-compose.yml
- [ ] Railway deployment
- [ ] CI/CD pipeline
- [ ] Health checks + monitoring

### Milestones de Integración
1. **M1**: CLI storage refactored → todos los comandos usan nuevo formato
2. **M2**: Backend + sync → puede sincronizar desde CLI al cloud
3. **M3**: Frontend live → web dashboard funcional
4. **M4**: Feature parity → todo funciona
5. **M5**: Production ready → launch público

---

## Archivos Críticos

### prjct-cli/ (FIRST - modificar existente)
```
core/storage/index.js          # NEW: Storage API
core/storage/file-storage.js   # NEW: File implementation
core/storage/path-utils.js     # NEW: Path manipulation
core/storage/migrations.js     # NEW: Migrate old format
core/events/bus.js             # NEW: Event bus
core/events/types.js           # NEW: Event definitions
core/sync/index.js             # NEW: Sync orchestration
core/sync/pending.js           # NEW: Pending events
core/sync/client.js            # NEW: API client
core/context/generator.js      # NEW: MD generation
core/context/templates.js      # NEW: MD templates
core/auth/login.js             # NEW: OAuth flow
packages/shared/schemas/*.ts   # NEW: Zod schemas
```

### prjct-api/ (nuevo)
```
main.py                        # FastAPI entry
app/models/*.py                # SQLAlchemy models
app/routers/sync.py            # /sync/* endpoints
app/routers/auth.py            # Auth endpoints
app/core/pty_manager.py        # Terminal management
app/core/websocket_manager.py  # Real-time sync
alembic/                       # DB migrations
Dockerfile                     # Container config
```

### prjct-web/ (nuevo - Vue 3)
```
src/App.vue                    # Main app
src/stores/*.ts                # Pinia stores
src/composables/*.ts           # useApi, useTerminal
src/components/*.vue           # Ported components
src/views/*.vue                # Pages
vite.config.ts                 # Build config
components.json                # shadcn-vue config
```

---

## Criterios de Éxito

1. **CLI storage** usa JSON granular (no más MD monolíticos para data)
2. **Context files** generados para Claude desde JSON data
3. **Sync incremental** solo en /p:ship y /p:sync
4. **Payloads pequeños** - solo entidades modificadas enviadas a API
5. **Feature parity** completa con implementación actual
6. **Multi-usuario** con compartir proyectos
7. **< 100ms latency** para respuestas API
8. **Terminal responsivo** igual que xterm.js actual
