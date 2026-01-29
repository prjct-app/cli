# 🌐 prjct.app - Copy Final

> Basado en análisis del código fuente real
> Sin promesas, solo lo que el código hace

---

## LO QUE PRJCT REALMENTE HACE (Del código)

1. **Memory System**: Aprende tus decisiones tras 3 repeticiones. Persiste en JSON local.
2. **Smart Context**: Filtra 40-70% del contexto irrelevante basado en dominio de la tarea.
3. **Orchestrator**: Fragmenta tareas de 3+ dominios automáticamente en subtareas ordenadas.
4. **Sync**: Un comando genera todo: CLAUDE.md, agentes por dominio, estado del proyecto.
5. **Task Stack**: Guarda estado de tareas con pausas, duraciones, y permite resume exacto.

---

# HERO

## Headline

> # Un comando. Tu proyecto listo para cualquier agente.

## Subheadline

> `prjct sync` analiza tu código, detecta tu stack, genera contexto optimizado para Claude Code, Cursor, Gemini y Windsurf. Todo local. Todo tuyo.

## Terminal

```bash
$ p. sync

✓ Stack: TypeScript + React + Hono + PostgreSQL
✓ Generated: CLAUDE.md, .cursorrules, GEMINI.md
✓ Agents: frontend, backend, database, testing
✓ Patterns: 12 learned from your history

Ready.
```

## CTA

```bash
npm install -g prjct-cli
```

---

# LO QUE HACE (Honesto)

## Headline

> ### Qué hace prjct por ti

## 1. Detecta tu stack automáticamente

```
$ p. sync

Detectado:
├── Frontend: React + TypeScript
├── Backend: Hono + Zod
├── Database: PostgreSQL + Prisma
├── Testing: Vitest
└── Docker: sí
```

No configuras nada. Lee tu código y lo entiende.

## 2. Genera contexto para cada agente

```
Generado:
├── CLAUDE.md      → Para Claude Code
├── .cursorrules   → Para Cursor
├── GEMINI.md      → Para Gemini CLI
└── .windsurfrules → Para Windsurf
```

Cada archivo en el formato que el agente espera.

## 3. Crea agentes especializados por dominio

```
Agentes:
├── frontend.md   → Solo sabe de React, CSS, componentes
├── backend.md    → Solo sabe de API, rutas, servicios
├── database.md   → Solo sabe de schemas, migrations
└── testing.md    → Solo sabe de tests, coverage
```

Cuando dices "add auth", carga backend + database. No frontend.

## 4. Aprende tus patrones

```
Después de 3 PRs, prjct sabe:
├── Nombras branches: feature/{slug}
├── Commits: conventional style
├── Siempre testeas antes de ship
└── Prefieres Hono sobre Express
```

No le dices. Lo infiere de tu trabajo.

## 5. Gestiona tus tareas con estado real

```bash
$ p. task "add user auth"
→ Tarea iniciada, timer corriendo

$ p. pause "almuerzo"
→ Timer pausado

$ p. resume
→ Timer continúa (no cuenta el almuerzo)

$ p. done
→ Duración real: 47 minutos (sin pausas)
```

---

# FLUJO REAL

## Un día usando prjct

```bash
# Mañana: sincronizas
$ p. sync
✓ Proyecto actualizado

# Empiezas a trabajar
$ p. task "PRJ-123: add payment flow"
✓ Context cargado: backend, database
✓ Patterns aplicados: 3 de tu historial

# Trabajas con Claude/Cursor/Gemini
# El agente ya sabe tu stack, tus patrones

# Terminas
$ p. done
✓ 2h 15m trabajadas
✓ Tarea movida a shipped.md

# Siguiente
$ p. next
→ PRJ-124: add email notifications (backend)
→ PRJ-125: update dashboard UI (frontend)
```

---

# PARA QUIÉN ES

## Funciona si:

- Usas Claude Code, Cursor, Gemini CLI, o Windsurf
- Trabajas en proyectos con código real (no notebooks)
- Quieres que tu agente entienda tu proyecto sin explicarlo cada vez
- Te molesta repetir "usamos Hono, no Express" en cada sesión

## No funciona si:

- No usas agentes de IA para codear
- Tu proyecto es un script de 50 líneas
- Prefieres configurar todo manualmente

---

# TÉCNICO

## Dónde vive todo

```
~/.prjct-cli/
├── projects/
│   └── {project-id}/
│       ├── context/
│       │   ├── now.md        ← Tarea actual
│       │   ├── next.md       ← Cola de tareas
│       │   └── shipped.md    ← Completadas
│       ├── memory/
│       │   ├── patterns.json ← Decisiones aprendidas
│       │   └── sessions/     ← Historial JSONL
│       ├── agents/           ← Agentes por dominio
│       └── state.json        ← Estado del proyecto
└── config.json               ← Config global
```

## Todo es local

- Tu código nunca sale de tu máquina
- Sin servidor, sin API, sin tracking
- JSON y Markdown que puedes leer y editar

## Open source

- CLI: MIT license
- Lo puedes forkear, modificar, extender

---

# PRICING

## Headline

> ### Empieza gratis

## Tiers

```
DEV (Gratis)              PRO ($8/mes)              TEAM ($12/seat)
─────────────────────────────────────────────────────────────────
1 proyecto                Proyectos ilimitados      Todo en Pro
Sync completo             Analytics                 Sync entre equipo
4 agentes                 Linear/Jira               Agentes compartidos
10 patterns max           Patterns ilimitados       SSO
7 días historial          Historial completo        Audit logs
                          Watch mode
                          Custom agents
```

## Filosofía

El tier gratis hace todo lo importante.
Pro es para quienes quieren analytics y múltiples proyectos.
Team es para equipos que comparten contexto.

---

# INSTALACIÓN

```bash
# Instalar
npm install -g prjct-cli

# En tu proyecto
cd tu-proyecto
p. init
p. sync

# Listo. Ahora tu agente entiende tu proyecto.
```

---

# FAQ

**¿Reemplaza a Claude/Cursor/etc?**
No. Funciona con ellos. Genera el contexto que necesitan.

**¿Dónde guarda mis datos?**
Local. `~/.prjct-cli/`. JSON y Markdown que puedes leer.

**¿Qué aprende exactamente?**
Decisiones que repites 3+ veces: naming, estilo de commits, preferencias de librerías.

**¿Funciona offline?**
Sí. Todo es local excepto sync con Linear/Jira (opcional).

**¿Puedo ver qué aprendió?**
Sí. `cat ~/.prjct-cli/projects/{id}/memory/patterns.json`

---

# LO QUE NO PROMETEMOS

- ❌ "10x más rápido" → No medimos velocidad, medimos contexto
- ❌ "AI mágica" → Es filtrado de contexto y persistencia de estado
- ❌ "Revolucionario" → Es pragmático: sync, task, done, ship

# LO QUE SÍ HACE

- ✓ Genera contexto para 4 agentes con un comando
- ✓ Aprende tus patrones tras 3 repeticiones
- ✓ Filtra 40-70% del contexto irrelevante
- ✓ Guarda estado de tareas con pausas reales
- ✓ Todo local, todo tuyo, todo legible

---

# META

## Title
`prjct — Contexto para agentes de IA`

## Description
`Un comando sincroniza tu proyecto para Claude Code, Cursor, Gemini y Windsurf. Stack detectado, agentes generados, patrones aprendidos. Todo local.`

---

# PRINCIPIOS DE ESTE COPY

1. **Solo lo que el código hace** — Cada claim está en el source
2. **Sin métricas inventadas** — No "127K tokens" sin medirlo
3. **Transparencia total** — Mostramos dónde viven los archivos
4. **Limitaciones claras** — Decimos para quién NO es
5. **Instalación real** — 3 comandos, funciona
