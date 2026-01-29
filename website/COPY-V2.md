# 🌐 prjct.app - Copy v2

> Basado en: Análisis real del producto, no marketing genérico
> El diferenciador: **Mostrar el valor que ya existe pero es invisible**

---

## EL INSIGHT CENTRAL

El problema de prjct no es que le falten features.
El problema es que el 70% del trabajo sofisticado es invisible.

**El copy debe reflejar esto:**
- No vender "context management" abstracto
- Mostrar números concretos: tokens ahorrados, archivos filtrados, tiempo ganado
- El usuario debe SENTIR el valor en cada interacción

---

# HERO

## Headline

> # 127,000 tokens ahorrados esta semana.
> # Y ni te diste cuenta.

## Subheadline

> prjct hace el trabajo invisible: filtra 2,341 archivos a 67 relevantes, aplica tus preferencias aprendidas, fragmenta tareas complejas automáticamente. Tu agente de IA recibe exactamente lo que necesita. Nada más.

## Stats ticker (animado)

```
┌─────────────────────────────────────────────────────────────┐
│  🔥 Esta semana en prjct:                                   │
│                                                             │
│  847 → 23 archivos    45,000 tokens    3 patrones          │
│  filtrados            ahorrados        aprendidos           │
└─────────────────────────────────────────────────────────────┘
```

## CTA

**Primary**: `npm install -g prjct-cli`
**Secondary**: `Ver qué hace por dentro →`

---

# PROBLEMA (Real, no genérico)

## Headline

> ### Tu agente de IA es poderoso. Pero ciego.

## El problema real (no el genérico)

```
Cuando escribes: "add user authentication"

Tu agente recibe:
├── 2,341 archivos de tu proyecto
├── 0 contexto de decisiones pasadas
├── 0 preferencias tuyas (branch naming, test style, etc.)
└── 0 conocimiento de tu arquitectura real

Resultado: Código genérico que no encaja.
Y 45,000 tokens desperdiciados en contexto irrelevante.
```

## Contraste

```
Con prjct:

├── 2,341 archivos → 23 relevantes (99% filtrado)
├── 15 decisiones pasadas aplicadas automáticamente
├── Tu estilo de código inyectado
└── Agentes especializados por dominio

Resultado: Código que parece tuyo desde el primer intento.
```

---

# CÓMO FUNCIONA (Técnico pero accesible)

## Headline

> ### 3 sistemas trabajando en silencio

## Sistema 1: Memory (3-tier)

```
┌─────────────────────────────────────────────────────────────┐
│  🧠 MEMORY SYSTEM                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tier 1: Session        → Lo que pasa ahora mismo          │
│  Tier 2: Patterns       → Tus preferencias aprendidas      │
│  Tier 3: History        → Audit log de todo                │
│                                                             │
│  Después de 3 PRs, prjct sabe:                              │
│  • Cómo nombras tus branches                                │
│  • Tu estilo de commits                                     │
│  • Si testeas antes de shipear                              │
│  • Qué agente prefieres para qué tarea                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Copy:**
> prjct aprende observando. No le dices tus preferencias — las infiere de tu trabajo real.

## Sistema 2: Smart Context

```
┌─────────────────────────────────────────────────────────────┐
│  🎯 SMART CONTEXT                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Input:  "add user authentication"                          │
│                                                             │
│  Análisis:                                                  │
│  ├── Dominio detectado: backend, database                   │
│  ├── Archivos relevantes: 23 de 2,341 (99% filtrado)        │
│  ├── Agentes cargados: backend.md, database.md              │
│  └── Patterns aplicados: 3 de tu historial                  │
│                                                             │
│  Tokens ahorrados: ~45,000                                  │
│  Tiempo de contexto: 0.2s (no 20s)                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Copy:**
> Tu agente no necesita ver package-lock.json para agregar autenticación. prjct filtra el ruido.

## Sistema 3: Orchestrator

```
┌─────────────────────────────────────────────────────────────┐
│  🔄 ORCHESTRATOR                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tarea: "build full checkout flow"                          │
│                                                             │
│  Detección: 3+ dominios → auto-fragmentación                │
│                                                             │
│  Plan generado:                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. [DATABASE] Schema de orders         ← Primero    │   │
│  │    └─ Agent: database.md                            │   │
│  │                                                      │   │
│  │ 2. [BACKEND] API de checkout           ← Depende #1 │   │
│  │    └─ Agent: backend.md                             │   │
│  │                                                      │   │
│  │ 3. [FRONTEND] UI de carrito            ← Depende #2 │   │
│  │    └─ Agent: frontend.md                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Progreso: ● ○ ○  (1/3)                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Copy:**
> Tareas complejas se fragmentan solas. En el orden correcto. Con el agente correcto.

---

# OUTPUT REAL (No mockups)

## Headline

> ### Esto es lo que ves cuando usas prjct

## Ejemplo: p. task

```bash
$ p. task "add user authentication"

✓ Task started: add user authentication

┌─ Context loaded ─────────────────────────────────────────────┐
│  Files:    847 → 23 relevant (97% filtered)                  │
│  Agents:   backend, database                                 │
│  Patterns: 3 from your history applied                       │
│  Tokens:   ~45,000 saved                                     │
└──────────────────────────────────────────────────────────────┘

💡 Applied your preferences:
   • Branch: feature/add-user-authentication
   • Commits: conventional style
   • Tests: before ship

Ready. Your agent knows your project.
```

## Ejemplo: p. done

```bash
$ p. done

✓ Task completed: add user authentication

┌─ Session Summary ────────────────────────────────────────────┐
│  Duration:     47 minutes                                    │
│  Subtasks:     3/3 ✓                                         │
│  Files changed: 12                                           │
│  Tests:        passing                                       │
└──────────────────────────────────────────────────────────────┘

┌─ Value delivered ────────────────────────────────────────────┐
│  Tokens saved:     ~45,000                                   │
│  Context filtered: 824 files removed                         │
│  Patterns used:    3                                         │
│  New pattern:      "JWT refresh token in httpOnly cookie"    │
└──────────────────────────────────────────────────────────────┘

→ Ready: p. ship  or  p. next
```

## Ejemplo: p. sync

```bash
$ p. sync

Syncing project...

┌─ Analysis ───────────────────────────────────────────────────┐
│  Git:      main (3 commits ahead)                            │
│  Stack:    TypeScript + React + Hono + PostgreSQL            │
│  Files:    2,341 total                                       │
│  Health:   98% (2 issues detected)                           │
└──────────────────────────────────────────────────────────────┘

┌─ Generated ──────────────────────────────────────────────────┐
│  ✓ CLAUDE.md      (optimized for Claude Code)               │
│  ✓ .cursorrules   (optimized for Cursor)                    │
│  ✓ GEMINI.md      (optimized for Gemini CLI)                │
│  ✓ 4 agents       (backend, frontend, database, testing)    │
└──────────────────────────────────────────────────────────────┘

┌─ Context ready ──────────────────────────────────────────────┐
│  Total context:  12.3 KB (compressed from 847 KB)            │
│  Agents loaded:  4 specialized                               │
│  Patterns:       23 from history                             │
└──────────────────────────────────────────────────────────────┘

Sync complete. All agents updated.
```

---

# NÚMEROS REALES

## Headline

> ### Métricas de una semana real

## Stats Grid

```
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│                   │  │                   │  │                   │
│     127,000       │  │       97%         │  │        23         │
│                   │  │                   │  │                   │
│  tokens ahorrados │  │ archivos filtrados│  │ patterns learned  │
│     esta semana   │  │   por sesión      │  │   acumulados      │
│                   │  │                   │  │                   │
└───────────────────┘  └───────────────────┘  └───────────────────┘

┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│                   │  │                   │  │                   │
│       0.2s        │  │        4          │  │       15          │
│                   │  │                   │  │                   │
│   context load    │  │  agentes activos  │  │  decisiones auto  │
│   (no 20s)        │  │  especializados   │  │  por sesión       │
│                   │  │                   │  │                   │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

---

# COMPARACIÓN HONESTA

## Headline

> ### Sin prjct vs Con prjct

```
┌─────────────────────────────────────────────────────────────────┐
│                        SIN PRJCT                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  $ claude "add user auth"                                       │
│                                                                 │
│  → Claude recibe 2,341 archivos                                 │
│  → No sabe tu arquitectura                                      │
│  → No conoce tus preferencias                                   │
│  → Genera código genérico                                       │
│  → Tú corriges manualmente                                      │
│  → Repites esto cada sesión                                     │
│                                                                 │
│  Tiempo: 45 min + frustración                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        CON PRJCT                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  $ p. task "add user auth"                                      │
│                                                                 │
│  → prjct filtra a 23 archivos relevantes                        │
│  → Inyecta tu arquitectura                                      │
│  → Aplica 3 patterns de tu historial                            │
│  → Código que parece tuyo                                       │
│  → Aprendizaje guardado para próxima vez                        │
│                                                                 │
│  Tiempo: 15 min + satisfacción                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# COMPATIBILIDAD

## Headline

> ### Un sync. Todos tus agentes.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  $ p. sync                                                      │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Claude    │  │   Cursor    │  │   Gemini    │             │
│  │    Code     │  │             │  │    CLI      │             │
│  │             │  │             │  │             │             │
│  │ CLAUDE.md   │  │.cursorrules │  │ GEMINI.md   │             │
│  │ optimizado  │  │ optimizado  │  │ optimizado  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │  Windsurf   │  │ Antigravity │                              │
│  │             │  │             │                              │
│  │.windsurfrules│ │   Skill     │                              │
│  │ optimizado  │  │ optimizado  │                              │
│  └─────────────┘  └─────────────┘                              │
│                                                                 │
│  Mismo proyecto. Mismo contexto. Formatos nativos.              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Copy:**
> Cambia de Claude a Cursor sin perder contexto. prjct genera el formato que cada agente espera.

---

# PRICING

## Headline

> ### Empieza gratis. Escala cuando quieras.

## Tiers

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  DEV                    PRO                    TEAM             │
│  Gratis                 $8/mes                 $12/seat/mes     │
│                                                                 │
│  ────────────────────────────────────────────────────────────   │
│                                                                 │
│  ✓ 1 proyecto           ✓ Proyectos ilimitados  ✓ Todo en Pro  │
│  ✓ Sync completo        ✓ Analytics dashboard   ✓ Team sync    │
│  ✓ 4 agentes            ✓ Linear/Jira           ✓ Shared agents│
│  ✓ Patterns (10 max)    ✓ Patterns ilimitados   ✓ Handoffs     │
│  ✓ History (7 días)     ✓ History ilimitado     ✓ SSO          │
│                         ✓ Custom agents         ✓ Audit logs   │
│                         ✓ Watch mode                           │
│                         ✓ Priority support                      │
│                                                                 │
│  [Empezar gratis]       [14 días gratis]        [Contactar]    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Filosofía

> El tier gratis es genuinamente útil. No es un demo crippled.
> Queremos que adoptes prjct y luego quieras Pro porque el valor es obvio.

---

# PRUEBA SOCIAL (Cuando exista)

## Formato preferido

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  "Usé prjct para lanzar mi SaaS en 8 semanas.                   │
│   El dashboard me mostró que ahorré 340,000 tokens              │
│   y aprendió 47 patterns de mi código."                         │
│                                                                 │
│   — JJ, creador de prjct (dogfooding extremo)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# CTA FINAL

## Headline

> ### ¿Cuántos tokens desperdiciaste hoy?

## Copy

> Instala prjct en 30 segundos. Tu primer sync te muestra exactamente cuánto contexto estabas desperdiciando.

## Install

```bash
npm install -g prjct-cli
cd tu-proyecto
p. init
p. sync

# Listo. Ve las métricas.
```

---

# SEO / META

## Title
`prjct — 127,000 tokens ahorrados esta semana`

## Description
`prjct filtra el 97% del ruido, aprende tus preferencias, y fragmenta tareas complejas automáticamente. Tu agente de IA recibe exactamente lo que necesita.`

## OG Image
Terminal mostrando: `Tokens saved: 127,000 | Files filtered: 97% | Patterns: 23`

---

# DIFERENCIAS CON V1

| Aspecto | V1 (SLOP) | V2 (Real) |
|---------|-----------|-----------|
| Headline | "Stop re-explaining" | "127,000 tokens ahorrados" |
| Enfoque | Features abstractos | Métricas concretas |
| Problema | Genérico | Específico (tokens, archivos) |
| Solución | "Universal sync" | 3 sistemas técnicos explicados |
| Output | Mockups | Terminal real con stats |
| Pricing | Bullets genéricos | Filosofía + diferenciadores claros |
| CTA | "Get started" | "¿Cuántos tokens desperdiciaste?" |

---

# PRINCIPIOS DEL COPY

1. **Números > Adjetivos**
   - ❌ "Faster context loading"
   - ✅ "0.2s context load (no 20s)"

2. **Mostrar el trabajo invisible**
   - Cada interacción muestra qué hizo prjct por dentro

3. **Técnico pero accesible**
   - Desarrolladores aprecian ver cómo funciona
   - No dumbing down, pero tampoco jargon innecesario

4. **Honestidad**
   - "El tier gratis es genuinamente útil"
   - Comparación real sin exagerar

5. **El valor es la visibilidad**
   - El producto ya es sofisticado
   - El copy hace visible ese valor
