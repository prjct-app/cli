# Análisis de Infraestructura: prjct MCP Server

## Resumen Ejecutivo

Después de analizar el ecosistema MCP y las mejores prácticas de 2025, la recomendación es clara: **usar el SDK oficial de TypeScript con Streamable HTTP y Supabase como backend**.

---

## Stack Recomendado

```
┌─────────────────────────────────────────────────────────┐
│  prjct MCP Server                                       │
├─────────────────────────────────────────────────────────┤
│  Runtime:     Node.js 20+ (LTS)                         │
│  Language:    TypeScript 5.x (strict mode)              │
│  SDK:         @modelcontextprotocol/server              │
│  Transport:   Streamable HTTP (stateful mode)           │
│  Validation:  Zod v3.25+                                │
│  Database:    Supabase (PostgreSQL + Realtime)          │
│  Auth:        Supabase Auth (JWT)                       │
└─────────────────────────────────────────────────────────┘
```

---

## Decisiones Técnicas

### 1. SDK: Official TypeScript SDK ✅

**Paquete**: `@modelcontextprotocol/server`

**Por qué**:
- Oficial de Anthropic/MCP team
- Soporte completo del protocolo
- Tipos TypeScript nativos
- Mantenimiento activo (v2 en Q1 2026)
- Zod integrado para validación

**Instalación**:
```bash
npm install @modelcontextprotocol/server zod
```

### 2. Transport: Streamable HTTP ✅

**Por qué Streamable HTTP sobre stdio**:
- prjct necesita **persistencia en cloud** (Supabase)
- Múltiples clientes (Claude, Cursor, etc.) conectándose
- Soporta sesiones stateful con IDs
- Resumability para conexiones largas
- Compatible con despliegue en cualquier hosting

**Modos disponibles**:
- **Stateless**: Sin tracking de sesión, ideal para APIs simples
- **Stateful**: Sesiones con IDs, resumability, features avanzados ← **ESTE**

### 3. Framework HTTP: Hono ✅

**Por qué Hono sobre Express**:
- Ya lo usamos en prjct-cli actual
- Ultra-ligero (12kb)
- TypeScript-first
- Edge-ready (Cloudflare Workers, Vercel)
- SDK oficial tiene middleware: `@modelcontextprotocol/hono`

**Alternativas consideradas**:
| Framework | Pros | Cons |
|-----------|------|------|
| Express | Más ejemplos, maduro | Más pesado, legacy patterns |
| Fastify | Rápido, schema validation | Menos ejemplos MCP |
| **Hono** | Ligero, ya lo usamos, edge-ready | **Seleccionado** |

### 4. Database: Supabase ✅

**Componentes a usar**:
- **PostgreSQL**: Storage principal
- **Realtime**: Subscriptions para dashboard
- **Auth**: JWT tokens, OAuth
- **Edge Functions**: Opcional para webhooks

**Schema ya diseñado** en RFC-002 (users, projects, tasks, patterns, events, integrations).

### 5. Validation: Zod ✅

**Por qué**:
- Requerido por MCP SDK
- Runtime + compile-time validation
- Excelente DX con TypeScript
- Ya lo conocemos

---

## Arquitectura del Server

```
src/
├── index.ts              # Entry point
├── server.ts             # McpServer instance
├── tools/                # MCP Tools
│   ├── state.ts          # prjct_get_state
│   ├── task.ts           # prjct_start_task, complete, pause, resume
│   ├── decision.ts       # prjct_log_decision
│   ├── context.ts        # prjct_get_context
│   ├── sync.ts           # prjct_sync_project
│   └── integrations.ts   # prjct_linear_sync
├── resources/            # MCP Resources
│   ├── project.ts        # project://current
│   ├── tasks.ts          # tasks://active
│   └── patterns.ts       # patterns://learned
├── db/                   # Supabase client
│   ├── client.ts         # Supabase init
│   ├── queries.ts        # SQL queries
│   └── types.ts          # Generated types
├── auth/                 # Authentication
│   └── middleware.ts     # JWT validation
└── lib/                  # Utilities
    ├── schemas.ts        # Zod schemas
    └── errors.ts         # Error handling
```

---

## Tools MCP (Especificación)

### Core Tools

```typescript
// 1. prjct_get_state
{
  name: 'prjct_get_state',
  description: 'Get current project state including active task, recent patterns, and context',
  inputSchema: z.object({
    project_id: z.string().uuid().optional()
  }),
  outputSchema: z.object({
    project: ProjectSchema,
    active_task: TaskSchema.nullable(),
    recent_patterns: z.array(PatternSchema),
    context_summary: z.string()
  })
}

// 2. prjct_start_task
{
  name: 'prjct_start_task',
  description: 'Start a new task with automatic domain detection and context loading',
  inputSchema: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    labels: z.array(z.string()).optional()
  }),
  outputSchema: z.object({
    task_id: z.string().uuid(),
    domain: z.enum(['frontend', 'backend', 'devops', 'general']),
    context_loaded: z.boolean(),
    linear_synced: z.boolean().optional()
  })
}

// 3. prjct_complete_task
{
  name: 'prjct_complete_task',
  description: 'Mark current task as completed with outcome summary',
  inputSchema: z.object({
    task_id: z.string().uuid(),
    outcome: z.string(),
    patterns_learned: z.array(z.string()).optional()
  })
}

// 4. prjct_log_decision
{
  name: 'prjct_log_decision',
  description: 'Log an architectural or technical decision for future reference',
  inputSchema: z.object({
    decision: z.string(),
    context: z.string(),
    alternatives: z.array(z.string()).optional(),
    rationale: z.string()
  })
}

// 5. prjct_get_context
{
  name: 'prjct_get_context',
  description: 'Get relevant context for current task based on domain and patterns',
  inputSchema: z.object({
    task_id: z.string().uuid().optional(),
    domain: z.string().optional()
  }),
  outputSchema: z.object({
    relevant_files: z.array(z.string()),
    recent_decisions: z.array(DecisionSchema),
    patterns: z.array(PatternSchema),
    preferences: z.record(z.string())
  })
}

// 6. prjct_linear_sync
{
  name: 'prjct_linear_sync',
  description: 'Sync task status bidirectionally with Linear',
  inputSchema: z.object({
    direction: z.enum(['push', 'pull', 'both']).default('both')
  })
}
```

---

## Seguridad

### DNS Rebinding Protection

```typescript
import { createMcpHonoApp } from '@modelcontextprotocol/hono';

const app = createMcpHonoApp({
  host: '0.0.0.0',
  allowedHosts: ['api.prjct.app', 'localhost']
});
```

### Authentication Flow

```
1. User logs in via prjct.app → gets Supabase JWT
2. Claude/Cursor configures MCP with JWT in headers
3. MCP Server validates JWT on each request
4. User ID extracted, queries scoped to user
```

### Rate Limiting

```typescript
// Per-user limits
const LIMITS = {
  free: { requests_per_minute: 30, projects: 3 },
  pro: { requests_per_minute: 100, projects: Infinity },
  team: { requests_per_minute: 300, projects: Infinity }
}
```

---

## Deployment Options

### Opción 1: Supabase Edge Functions (Recomendado para MVP)

**Pros**:
- Todo en un lugar (DB + Functions)
- Scaling automático
- Cold starts rápidos con Deno
- Sin servidor que mantener

**Cons**:
- Deno (no Node), requiere adaptar imports
- Límites de ejecución

### Opción 2: Vercel/Cloudflare (Recomendado para producción)

**Pros**:
- Node.js nativo
- Edge network global
- Hono funciona perfecto
- Familiar

**Cons**:
- Otro servicio que manejar
- Costos adicionales

### Opción 3: VPS (Railway, Fly.io)

**Pros**:
- Control total
- Persistencia en memoria si necesaria
- WebSockets nativos

**Cons**:
- Más mantenimiento
- Scaling manual

**Recomendación**: Empezar con **Vercel** (familiar, edge-ready, free tier generoso) y evaluar Supabase Edge Functions para v2.

---

## Estimación de Desarrollo

| Fase | Componente | Tiempo |
|------|------------|--------|
| 1 | Setup proyecto + SDK + Supabase | 2-3 días |
| 2 | Tools core (state, task, decision) | 3-4 días |
| 3 | Auth + Rate limiting | 2 días |
| 4 | Linear integration | 2 días |
| 5 | Testing + debugging | 3 días |
| 6 | Deploy + docs | 2 días |
| **Total** | | **~3 semanas** |

---

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| SDK cambia en v2 | Usar v1.x estable, migrar después |
| Latencia DB | Índices correctos, connection pooling |
| Cold starts | Vercel Edge o keep-alive |
| Compatibilidad clientes | Testear con Claude, Cursor, VS Code |

---

## Conclusión

**La infraestructura óptima para prjct MCP es:**

1. **TypeScript** con SDK oficial de MCP
2. **Hono** como framework HTTP (ya lo conocemos)
3. **Streamable HTTP** stateful para sesiones
4. **Supabase** para DB + Auth + Realtime
5. **Vercel** para hosting inicial
6. **Zod** para validación (requerido por SDK)

Esta combinación nos da:
- ✅ Ejecución determinística (no más templates frágiles)
- ✅ Compatibilidad con todos los AI agents
- ✅ Dashboard en tiempo real
- ✅ Escalabilidad desde día 1
- ✅ Stack familiar (TypeScript, Hono, Supabase)

---

## Sources

- [Official MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP SDK on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [Anthropic Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [MCP Server Development Guide](https://github.com/cyanheads/model-context-protocol-resources/blob/main/guides/mcp-client-development-guide.md)
- [MCP Production Results Discussion](https://github.com/orgs/modelcontextprotocol/discussions/629)
