---
allowed-tools: [Read]
description: 'Context-aware suggestions based on project state and momentum'
---

# /p:suggest

## Purpose

Analyze project state and recommend next best actions based on:
- Current task status
- Queue state
- Time since last ship
- Recent velocity
- Patterns and momentum

## Usage

```
/p:suggest
```

## Flow

1. **Read state files**:
   - `core/now.md` → Current task
   - `core/next.md` → Queue
   - `progress/shipped.md` → Recent ships
   - `planning/roadmap.md` → Active features
   - Sessions from last 7 days (if available)

2. **Calculate metrics**:
   - Days since last ship
   - Active task duration
   - Queue size
   - Velocity (features/week)
   - Completion rate

3. **Detect patterns**:
   - Long-running task (>1 day)
   - Stale queue (not updated recently)
   - High velocity (shipping frequently)
   - Low activity (no movement)
   - Blocked tasks

4. **Generate recommendations**:
   - Immediate action (what to do RIGHT NOW)
   - Urgency alerts (if any)
   - Momentum tips (maintain or improve)
   - Strategic suggestions (longer-term)

## Analysis Logic

### Scenario 1: No Active Task + Queue Has Tasks

**Pattern**: Ready to work, tasks available

**Recommendation**:
```
⚡ ACCIÓN INMEDIATA
Tienes {N} tareas esperando
→ /p:next (ver prioridades)
→ /p:build 1 (empezar top priority)
```

### Scenario 2: Active Task + Long Duration (>4h)

**Pattern**: Might be stuck or need break

**Recommendation**:
```
⏱️  ALERTA DE TIEMPO
Tarea "{task}" lleva {duration}

¿Estás atorado?
→ /p:stuck "{descripción}" (pedir ayuda)
→ /p:done (si ya terminaste y olvidaste marcar)

¿Es muy grande?
→ Considera dividirla en tareas más pequeñas
```

### Scenario 3: No Ships in 3+ Days

**Pattern**: Losing momentum

**Recommendation**:
```
🔥 URGENTE: {N} días sin ship

Acción recomendada:
→ Completa algo HOY (aunque sea pequeño)
→ /p:next → pick quick win → /p:ship

Momentum = Motivation
No dejes que se enfríe!
```

### Scenario 4: Empty Queue + No Active Task

**Pattern**: Need planning

**Recommendation**:
```
💡 NECESITAS PLANEAR

Opciones:

1. Agregar nueva feature
   /p:feature "{descripción}"

2. Analizar proyecto
   /p:analyze
   → Descubre TODOs y mejoras

3. Revisar roadmap
   /p:roadmap
   → Ver features planificadas

4. Reportar bug
   /p:bug "{descripción}"
```

### Scenario 5: High Velocity (2+ ships/week)

**Pattern**: Great momentum!

**Recommendation**:
```
🚀 EXCELENTE RITMO!

Velocidad: {X} features/semana

Mantén el momentum:
→ Sigue con el siguiente task
→ Considera agregar tests si no los tienes
→ Documenta mientras shipeas

¡Vas muy bien! 🎉
```

### Scenario 6: Queue Growing (10+ tasks)

**Pattern**: Over-planning, under-doing

**Recommendation**:
```
⚠️  COLA MUY GRANDE ({N} tareas)

Recomendación:
→ STOP agregando tareas
→ START completándolas

Acción:
/p:build 1 → /p:done → repeat

Ship > Plan
```

## Response Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 SUGERENCIAS PERSONALIZADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ANÁLISIS:
  • Tarea activa: {current_task | "ninguna"}
  • En cola: {N} tareas
  • Último ship: {time_ago}
  • Velocidad: {X} features/semana

━━━━━━━━━━━━━━━━━━━━━━━━━━━

{urgency_section_if_applicable}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 TE RECOMIENDO:

1. ⚡ ACCIÓN INMEDIATA
   {immediate_action}
   → {command_1}
   → {command_2}

2. 💡 {category_2}
   {suggestion_2}
   → {command}

3. 🎯 {category_3}
   {suggestion_3}
   → {optional_command}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

{motivational_message}

¿Qué prefieres hacer?
```

## Examples

### Example 1: Ready to Work

```
/p:suggest

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 SUGERENCIAS PERSONALIZADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ANÁLISIS:
  • Tarea activa: ninguna
  • En cola: 5 tareas
  • Último ship: hace 1 día
  • Velocidad: 3 features/semana

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 TE RECOMIENDO:

1. ⚡ ACCIÓN INMEDIATA
   Tienes 5 tareas esperando y buen momentum
   → /p:next (ver prioridades)
   → /p:build 1 (empezar top priority)

2. 🚀 MOMENTUM
   Estás en excelente ritmo (3 features/semana)
   → Mantén el flow
   → Shiped ayer, hoy puedes completar otra

3. 💡 CALIDAD
   Con esta velocidad, considera:
   → Agregar tests si no los tienes
   → Documentar mientras shipeas
   → Code review de features recientes

━━━━━━━━━━━━━━━━━━━━━━━━━━━

¡Vas muy bien! Sigue así 🎉

¿Empezamos con /p:next?
```

### Example 2: Stuck on Task

```
/p:suggest

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 SUGERENCIAS PERSONALIZADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ANÁLISIS:
  • Tarea activa: "implement websocket connection"
  • Duración: 6 horas
  • En cola: 3 tareas
  • Último ship: hace 3 días

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  ALERTA: Tarea larga + Sin ships recientes

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 TE RECOMIENDO:

1. ⚡ ACCIÓN INMEDIATA
   ¿Estás atorado con websockets?

   Opciones:
   → /p:stuck "websocket issues" (pedir ayuda)
   → /p:done (si ya terminaste y olvidaste)

   ¿La tarea es muy grande?
   → Considera dividirla:
     - Setup básico de websocket
     - Implementar eventos
     - Testing y manejo de errores

2. 🔥 URGENTE
   3 días sin ship → Momentum en riesgo

   → Completa ALGO hoy (aunque sea pequeño)
   → Ship > Perfect
   → Puedes iterar después

3. 💡 ALTERNATIVA
   Si websockets está bloqueado:
   → /p:next (ver otras tareas)
   → Trabaja en algo más mientras investigas
   → Mantén el momentum

━━━━━━━━━━━━━━━━━━━━━━━━━━━

No te quedes atascado! Pide ayuda o ship algo más pequeño.

¿Necesitas ayuda con websockets?
```

### Example 3: Losing Momentum

```
/p:suggest

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 SUGERENCIAS PERSONALIZADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ANÁLISIS:
  • Tarea activa: ninguna
  • En cola: 8 tareas
  • Último ship: hace 5 días ⚠️
  • Velocidad: 0.4 features/semana

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 URGENTE: 5 DÍAS SIN SHIP

El momentum se está perdiendo!

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 TE RECOMIENDO:

1. ⚡ ACCIÓN INMEDIATA (HOY)
   Completa UNA tarea pequeña

   → /p:next (busca quick win)
   → /p:build {la más fácil}
   → /p:done → /p:ship MISMO DÍA

   Objetivo: Romper el ciclo de inactividad

2. 🎯 ESTRATEGIA
   Tienes 8 tareas en cola
   → Demasiado planning, poco doing

   STOP: Agregar más tareas
   START: Completar las existentes

   Ship > Plan

3. 💡 MANTÉN MOMENTUM
   Una vez que ships hoy:
   → Ship algo cada 1-2 días
   → Tareas pequeñas > Tareas grandes
   → Celebra cada win (por pequeño que sea)

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Momentum = Motivation
¡Vamos a shipear algo HOY! 🚀

¿Listo para ver tu cola y elegir un quick win?
```

### Example 4: Need Planning

```
/p:suggest

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 SUGERENCIAS PERSONALIZADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ANÁLISIS:
  • Tarea activa: ninguna
  • En cola: 0 tareas
  • Último ship: hace 2 horas ✅
  • Velocidad: 4 features/semana

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 TE RECOMIENDO:

1. 💡 PLANEAR SIGUIENTE FEATURE
   Acabas de ship → Excelente!
   Cola vacía → Necesitas planear

   Opciones:

   A) Agregar nueva feature
      /p:feature "{descripción}"
      → Análisis de valor
      → Task breakdown
      → Auto-start

   B) Analizar proyecto
      /p:analyze
      → Descubre TODOs automáticamente
      → Identifica mejoras
      → Genera tareas

   C) Revisar roadmap
      /p:roadmap
      → Ver features planificadas
      → Decidir siguiente

2. 🚀 MOMENTUM EXCELENTE
   4 features/semana → Top tier!

   → Mantén este ritmo
   → Considera refactors si no los has hecho
   → Tests, docs, optimizaciones

3. 🎯 CALIDAD
   Con alta velocidad, asegura:
   → Code quality (linting, formatting)
   → Test coverage
   → Documentation
   → No technical debt

━━━━━━━━━━━━━━━━━━━━━━━━━━━

¡Excelente trabajo! Sigue así 🎉

¿Qué feature quieres agregar?
```

### Example 5: Over-Planning

```
/p:suggest

━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 SUGERENCIAS PERSONALIZADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ANÁLISIS:
  • Tarea activa: ninguna
  • En cola: 15 tareas ⚠️
  • Último ship: hace 1 día
  • Velocidad: 2 features/semana

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  ALERTA: COLA MUY GRANDE

Ratio planning/doing desbalanceado

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 TE RECOMIENDO:

1. ⚡ ACCIÓN INMEDIATA
   STOP → Agregar más tareas
   START → Completar las existentes

   → /p:next (ver top 5)
   → /p:build 1
   → /p:done
   → Repeat

   Objetivo: Reducir cola a <5 tareas

2. 🎯 ESTRATEGIA
   Con 15 tareas y velocidad de 2/semana:
   → Necesitas 7+ semanas para completar
   → Muchas tareas se volverán obsoletas

   Mejor enfoque:
   → Completa 5-7 tareas
   → Reevalúa el resto
   → Elimina las que ya no son relevantes

3. 💡 PRINCIPIO
   Ship Fast No BS

   → Tareas en cola NO agregan valor
   → Solo las completadas cuentan
   → Small batches > Big queues

   Execution > Planning

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Menos planning, más shipping! 🚀

¿Listo para empezar a vaciar esa cola?
```

## Urgency Levels

### 🟢 Green (All Good)
- Active task or ready to start
- Shipped within last 2 days
- Good velocity (2+ features/week)

**Message**: Positive reinforcement, keep momentum

### 🟡 Yellow (Attention Needed)
- Task running >4 hours
- 3-4 days since last ship
- Queue growing (>7 tasks)

**Message**: Gentle nudge, suggest action

### 🔴 Red (Urgent)
- 5+ days since last ship
- Task running >24 hours
- Queue >10 tasks with no activity

**Message**: Direct call to action, break the pattern

## Key Principles

1. **Data-driven**: Base suggestions on actual metrics
2. **Actionable**: Always provide specific commands
3. **Motivational**: Encourage without being annoying
4. **Honest**: If momentum is low, say it
5. **Pattern recognition**: Detect stuck/blocked scenarios
6. **Contextual**: Suggestions fit current state
7. **Bilingual**: Support both English and Spanish

## Validation

- **Requires init**: Must have prjct project
- **Read-only**: Never modifies files
- **No parameters**: Just analyzes current state

## Edge Cases

### Incomplete data
```
📊 Limited data available

Based on what I can see:
{partial_analysis}

Tip: Use prjct more to get better suggestions!
- /p:build → Track tasks
- /p:done → Record completions
- /p:ship → Celebrate wins
```

### First time usage
```
👋 First time using /p:suggest!

I'll analyze your project and suggest next steps.

{standard_analysis}

Tip: Use /p:suggest anytime you're wondering "what should I do now?"
```

## Success Criteria

After using `/p:suggest`, user should:
- ✅ Know exactly what to do next
- ✅ Understand WHY that's the best action
- ✅ Feel motivated to act
- ✅ Have specific commands to run
- ✅ Understand their momentum/velocity
