---
allowed-tools: [Read]
description: 'Conversational intent to action translator - helps users understand what to do'
---

# /p:ask

## Purpose

Translate natural language intent into actionable prjct command flows. Helps users who know WHAT they want but don't know HOW to do it with prjct.

## Usage

```
/p:ask "<what you want to do>"
```

## Flow

1. **Understand intent**: Parse user's natural language description
2. **Analyze context**: Read project state (core/now.md, core/next.md, planning/roadmap.md)
3. **Recommend flow**: Suggest specific command sequence with explanations
4. **Offer templates**: If applicable, show examples from similar use cases
5. **Ask confirmation**: Interactive - don't execute automatically

## Intent Categories

Claude analyzes and maps to one of these patterns:

### 1. Feature Development
Keywords: "add", "implement", "create", "build", "agregar", "implementar", "crear"

**Recommended flow:**
```
1. /p:feature "{description}"
   → Value analysis (impact/effort/timing)
   → Task breakdown
   → Auto-start first task

2. /p:done (after each task)

3. /p:ship "{feature name}" (when complete)
```

### 2. Performance/Optimization
Keywords: "optimize", "improve", "faster", "performance", "memory leak", "optimizar", "mejorar"

**Recommended flow:**
```
1. /p:feature "optimize {area}"
   → Break down into measurable tasks:
     • Profile and identify bottlenecks
     • Implement specific optimizations
     • Measure improvements
     • Document findings

2. /p:build 1 (start with profiling)

3. /p:done (iterate through tasks)

4. /p:ship "performance optimization"
```

### 3. Bug Fixing
Keywords: "bug", "error", "fix", "broken", "not working", "arreglar", "error"

**Recommended flow:**
```
1. /p:bug "{description}"
   → Auto-prioritized based on severity
   → Added to queue

2. /p:build "{bug task}" (if high priority)

3. /p:done (when fixed)

4. /p:ship "bug fixes" (if part of larger batch)
```

### 4. Design/Architecture
Keywords: "design", "architecture", "structure", "plan", "diseñar", "arquitectura"

**Recommended flow:**
```
1. /p:design {target} --type {architecture|api|component|database|flow}
   → Create design document
   → Plan implementation

2. /p:feature "implement {design}"
   → Convert design to tasks

3. /p:build 1 (start implementation)
```

### 5. Lost/Confused
Keywords: "don't know", "help", "stuck", "what should", "no sé", "ayuda"

**Recommended flow:**
```
1. /p:suggest
   → Context-aware recommendations
   → Shows current state
   → Suggests next best action

OR

2. /p:help
   → Interactive guide
   → Shows available commands
   → Examples
```

## Response Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Entiendo: {interpreted_intent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 TU CONTEXTO:
  • Estado actual: {current_state}
  • Tareas activas: {active_tasks}
  • Último ship: {time_ago}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 RECOMENDACIÓN DE FLUJO:

{step_by_step_command_flow}

Cada paso explicado:
→ {command_1}: {why_this_command}
→ {command_2}: {what_it_does}
→ {command_3}: {expected_outcome}

━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ EJEMPLOS SIMILARES:

"{similar_example_1}"
"{similar_example_2}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━

¿Quieres que ejecute el paso 1?
[Sí] [No, solo dame las tareas] [Necesito más ayuda]
```

## Examples

### Example 1: Performance Optimization

**Input:**
```
/p:ask "quiero mejorar el performance y evitar memory leaks"
```

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Entiendo: optimización de performance + solución de memory leaks
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 TU CONTEXTO:
  • Estado actual: sin tarea activa
  • Tareas en cola: 3
  • Último ship: hace 2 días

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 RECOMENDACIÓN DE FLUJO:

1. /p:feature "optimizar performance y memory leaks"

   Claude analizará y creará tareas como:
   • Setup profiler (Chrome DevTools/React DevTools)
   • Identificar memory leaks con heap snapshots
   • Optimizar re-renders innecesarios
   • Implementar memoization (useMemo, useCallback)
   • Code splitting para reducir bundle size
   • Medir mejoras y documentar

2. /p:build 1
   → Empezar con el profiling (necesitas datos primero)

3. /p:done
   → Después de cada tarea completada

4. /p:ship "performance optimization"
   → Cuando hayas terminado todas las mejoras

━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ POR QUÉ ESTE FLUJO:

→ /p:feature: Analiza el valor (impacto alto, esfuerzo medio)
             Recomienda timing (hacer ahora antes de más features)
             Breakdown inteligente (primero medir, luego optimizar)

→ /p:build:   Asigna agente apropiado (probablemente FE)
             Tracking de tiempo
             Focus en una tarea a la vez

→ /p:done:    Registra progreso
             Mantiene momentum
             Mueve a siguiente tarea

→ /p:ship:    Commit + push + celebración
             Actualiza docs
             Registra el logro

━━━━━━━━━━━━━━━━━━━━━━━━━━━

¿Empezamos con /p:feature para analizar el valor y crear las tareas?
```

### Example 2: New Feature

**Input:**
```
/p:ask "I want to add user authentication"
```

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 I understand: implement user authentication system
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 YOUR CONTEXT:
  • Current state: working on "navbar redesign"
  • Queue: 2 tasks
  • Last ship: 1 day ago

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  IMPORTANTE: Tienes tarea activa

Opciones:

A) TERMINAR PRIMERO (Recomendado)
   1. /p:done → Terminar "navbar redesign"
   2. /p:feature "user authentication"
   3. /p:build 1 → Empezar auth

B) GUARDAR PARA DESPUÉS
   1. /p:feature "user authentication"
      → Se agrega a la cola
   2. Continúa con navbar
   3. /p:done cuando termines navbar
   4. /p:build "authentication" cuando estés listo

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 RECOMENDACIÓN:

Termina navbar primero (mantiene focus)
Luego /p:feature "authentication" hará:

• Análisis de valor (impacto: HIGH)
• Stack analysis (sugiere: Clerk, Auth0, o custom JWT)
• Task breakdown:
  - Setup auth provider
  - Implement login/signup UI
  - Protected routes
  - Session management
  - Testing

• Auto-start primera tarea

━━━━━━━━━━━━━━━━━━━━━━━━━━━

¿Qué prefieres: A) Terminar navbar primero, o B) Agregar a cola?
```

### Example 3: Lost/Confused

**Input:**
```
/p:ask "no sé qué hacer ahora"
```

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Entiendo: necesitas orientación sobre qué hacer
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 TU CONTEXTO:
  • Estado actual: sin tarea activa ✅
  • Tareas en cola: 5 tareas esperando
  • Último ship: hace 4 días ⚠️

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 TE RECOMIENDO:

1. VER TU COLA DE TAREAS
   /p:next
   → Muestra las 5 tareas top priority
   → Ya están priorizadas y listas para trabajar

2. EMPEZAR LA TAREA #1
   /p:build 1
   → Empieza automáticamente la tarea top priority
   → Asigna agente apropiado
   → Tracking de tiempo

3. VER SUGERENCIAS INTELIGENTES
   /p:suggest
   → Analiza tu contexto completo
   → Recomienda basado en:
     - Tiempo sin ship (4 días)
     - Velocidad reciente
     - Urgencias

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 MI SUGERENCIA ESPECÍFICA:

Han pasado 4 días sin ship → Es momento de completar algo

Opción A: Trabaja en tareas de cola
   /p:next → /p:build 1 → /p:done → /p:ship

Opción B: Crea algo nuevo rápido
   /p:feature "quick win" → /p:build 1 → ship today

━━━━━━━━━━━━━━━━━━━━━━━━━━━

¿Qué prefieres?
1. Ver qué hay en cola (/p:next)
2. Sugerencias personalizadas (/p:suggest)
3. Contarme qué tienes en mente
```

## Key Principles

1. **Conversational**: Natural language, not technical
2. **Educational**: Explain WHY each command
3. **Contextual**: Always check project state first
4. **Interactive**: Ask confirmation, offer choices
5. **No auto-execution**: Show the path, let user decide
6. **Bilingual**: Support English and Spanish naturally
7. **Examples**: Show similar use cases when relevant

## Validation

- **Optional**: Can run without project initialized
- **If not initialized**: Suggest `/p:init` first
- **Read-only**: Never modifies files, only recommends

## Edge Cases

### No prjct project
```
⚠️  No prjct project here

First, initialize:
/p:init                    # For existing project
/p:init "your idea"        # For new project

Then I can help you!
```

### Very vague request
```
🤔 Puedes darme más detalles?

Qué quieres hacer:
• Agregar nueva funcionalidad?
• Arreglar algo que no funciona?
• Mejorar el código existente?
• No estás seguro?

Cuéntame más y te ayudo a encontrar el comando correcto!
```

## Success Criteria

After using `/p:ask`, user should:
- ✅ Understand WHAT commands to use
- ✅ Understand WHY those commands
- ✅ Understand the SEQUENCE of actions
- ✅ Feel confident to proceed
- ✅ Learn the system while using it
