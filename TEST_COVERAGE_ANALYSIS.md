# Análisis de Cobertura de Tests - prjct-cli

## 📊 Resumen

Este documento identifica qué partes del código necesitan más pruebas o no tienen ninguna.

## ✅ Archivos CON Tests

### Agentic (6/7 archivos - 86%)
- ✅ `agentic/command-executor.js` → `__tests__/agentic/command-executor.test.js`
- ✅ `agentic/context-builder.js` → `__tests__/agentic/context-builder.test.js`
- ✅ `agentic/context-filter.js` → `__tests__/agentic/context-filter.test.js` (RECIÉN AGREGADO)
- ✅ `agentic/prompt-builder.js` → `__tests__/agentic/prompt-builder.test.js`
- ✅ `agentic/template-loader.js` → `__tests__/agentic/template-loader.test.js`
- ✅ `agentic/tool-registry.js` → `__tests__/agentic/tool-registry.test.js`
- ❌ `agentic/agent-router.js` → **SIN TESTS** ⚠️ CRÍTICO

### Domain (1/5 archivos - 20%)
- ✅ `domain/agent-generator.js` → `__tests__/domain/agent-generator.test.js`
- ❌ `domain/analyzer.js` → **SIN TESTS** ⚠️ CRÍTICO
- ❌ `domain/architect-session.js` → **SIN TESTS** ⚠️ CRÍTICO
- ❌ `domain/architecture-generator.js` → **SIN TESTS**
- ❌ `domain/task-stack.js` → **SIN TESTS**

### Infrastructure (0/12 archivos - 0%) ⚠️ CRÍTICO
- ❌ `infrastructure/agent-detector.js` → **SIN TESTS**
- ❌ `infrastructure/author-detector.js` → **SIN TESTS**
- ❌ `infrastructure/capability-installer.js` → **SIN TESTS**
- ❌ `infrastructure/command-installer.js` → **SIN TESTS**
- ❌ `infrastructure/config-manager.js` → **SIN TESTS** ⚠️ CRÍTICO
- ❌ `infrastructure/editors-config.js` → **SIN TESTS**
- ❌ `infrastructure/legacy-installer-detector.js` → **SIN TESTS**
- ❌ `infrastructure/migrator.js` → **SIN TESTS** ⚠️ CRÍTICO
- ❌ `infrastructure/path-manager.js` → **SIN TESTS** ⚠️ CRÍTICO
- ❌ `infrastructure/session-manager.js` → **SIN TESTS**
- ❌ `infrastructure/setup.js` → `__tests__/setup.test.js` (solo básico)
- ❌ `infrastructure/update-checker.js` → **SIN TESTS**
- ❌ `infrastructure/agents/claude-agent.js` → **SIN TESTS**

### Utils (2/7 archivos - 29%)
- ✅ `utils/date-helper.js` → `__tests__/utils/date-helper.test.js`
- ✅ `utils/file-helper.js` → `__tests__/utils/file-helper.test.js`
- ❌ `utils/animations.js` → **SIN TESTS**
- ❌ `utils/jsonl-helper.js` → **SIN TESTS** ⚠️ IMPORTANTE
- ❌ `utils/project-capabilities.js` → **SIN TESTS**
- ❌ `utils/session-helper.js` → **SIN TESTS`
- ❌ `utils/version.js` → **SIN TESTS**

### Core Files (0/3 archivos - 0%) ⚠️ CRÍTICO
- ❌ `commands.js` → **SIN TESTS** ⚠️ MUY CRÍTICO (2928 líneas, lógica principal)
- ❌ `command-registry.js` → **SIN TESTS** ⚠️ CRÍTICO
- ❌ `index.js` → **SIN TESTS** ⚠️ CRÍTICO (entry point)

---

## 🔴 PRIORIDAD ALTA - Archivos Críticos Sin Tests

### 1. `core/commands.js` (2928 líneas) - ⚠️ MUY CRÍTICO
**Por qué es crítico:**
- Contiene TODA la lógica de ejecución de comandos
- Maneja 18+ comandos diferentes
- Integra múltiples sistemas (config, paths, agents, etc.)
- Es el punto central de toda la funcionalidad

**Qué probar:**
- Inicialización de comandos
- Ejecución de cada comando (`init`, `analyze`, `sync`, `feature`, `bug`, `now`, `done`, `next`, `ship`, etc.)
- Manejo de errores
- Validación de parámetros
- Integración con otros módulos

### 2. `core/infrastructure/config-manager.js` - ⚠️ CRÍTICO
**Por qué es crítico:**
- Gestiona toda la configuración del proyecto
- Lee/escribe `prjct.config.json`
- Maneja configuración global vs local
- Es usado por TODOS los comandos

**Qué probar:**
- Lectura de config existente
- Escritura de nueva config
- Validación de estructura
- Manejo de config corrupta/missing
- Migración de versiones

### 3. `core/infrastructure/path-manager.js` - ⚠️ CRÍTICO
**Por qué es crítico:**
- Gestiona TODOS los paths del sistema
- Convierte entre paths locales y globales
- Es usado por TODOS los módulos de I/O
- Un error aquí rompe todo el sistema

**Qué probar:**
- Construcción de paths globales
- Construcción de paths locales
- Validación de paths
- Manejo de paths inválidos
- Creación de directorios

### 4. `core/infrastructure/migrator.js` - ⚠️ CRÍTICO
**Por qué es crítico:**
- Migra datos entre versiones
- Maneja datos de usuarios reales
- Un error puede perder datos
- Es crítico para actualizaciones

**Qué probar:**
- Migración de versiones antiguas
- Preservación de datos
- Manejo de errores durante migración
- Rollback en caso de fallo

### 5. `core/domain/analyzer.js` - ⚠️ CRÍTICO
**Por qué es crítico:**
- Analiza repositorios completos
- Detecta tecnologías y stack
- Genera análisis para agentes
- Es usado por `/p:analyze` y `/p:init`

**Qué probar:**
- Detección de tecnologías (JS, TS, Python, etc.)
- Análisis de estructura de proyecto
- Generación de resúmenes
- Manejo de proyectos grandes
- Edge cases (proyectos vacíos, corruptos, etc.)

### 6. `core/agentic/agent-router.js` - ⚠️ CRÍTICO
**Por qué es crítico:**
- Asigna agentes especializados a tareas
- Es parte del sistema agentic core
- Determina qué agente maneja cada comando

**Qué probar:**
- Asignación correcta de agentes
- Detección de tipo de tarea
- Selección de agente apropiado
- Manejo de tareas desconocidas

---

## 🟡 PRIORIDAD MEDIA - Archivos Importantes Sin Tests

### 7. `core/domain/architect-session.js`
- Maneja sesiones de arquitectura
- Usado por modo ARCHITECT en `/p:init`
- Gestiona estado de conversación

### 8. `core/utils/jsonl-helper.js`
- Lee/escribe archivos JSONL
- Usado para logs y memoria
- Maneja formato crítico de datos

### 9. `core/infrastructure/command-installer.js`
- Instala comandos en editores
- Configuración de Claude Code/Desktop
- Importante para setup inicial

### 10. `core/infrastructure/author-detector.js`
- Detecta autor desde git
- Usado en inicialización
- Maneja múltiples fuentes de datos

---

## 🟢 PRIORIDAD BAJA - Archivos Menos Críticos

### 11. `core/domain/architecture-generator.js`
- Genera arquitecturas (puede ser mockeado)

### 12. `core/domain/task-stack.js`
- Stack de tareas (lógica simple)

### 13. `core/utils/project-capabilities.js`
- Detecta capacidades del proyecto

### 14. `core/utils/session-helper.js`
- Helpers para sesiones

### 15. `core/utils/animations.js`
- Animaciones de terminal (cosmético)

### 16. `core/utils/version.js`
- Versión del paquete (simple)

---

## 📋 Plan de Acción Recomendado

### Fase 1: Críticos (1-2 semanas)
1. ✅ `context-filter.js` - COMPLETADO
2. `commands.js` - Tests de comandos principales
3. `config-manager.js` - Tests completos
4. `path-manager.js` - Tests completos
5. `analyzer.js` - Tests de detección

### Fase 2: Importantes (1 semana)
6. `migrator.js` - Tests de migración
7. `agent-router.js` - Tests de asignación
8. `architect-session.js` - Tests de sesión
9. `jsonl-helper.js` - Tests de I/O

### Fase 3: Completar (1 semana)
10. Resto de infrastructure
11. Resto de utils
12. Resto de domain

---

## 🎯 Métricas Objetivo

**Cobertura Actual:**
- Agentic: 86% (6/7)
- Domain: 20% (1/5)
- Infrastructure: 0% (0/12)
- Utils: 29% (2/7)
- Core: 0% (0/3)
- **Total: ~15%**

**Cobertura Objetivo:**
- Agentic: 100% (7/7)
- Domain: 80% (4/5)
- Infrastructure: 70% (8/12)
- Utils: 70% (5/7)
- Core: 100% (3/3)
- **Total: ~75%**

---

## 💡 Notas

- Los tests de `commands.js` pueden ser complejos porque requiere mocks de muchos módulos
- Los tests de `migrator.js` deben ser muy cuidadosos para no corromper datos reales
- Los tests de `path-manager.js` deben funcionar en diferentes sistemas operativos
- Considerar tests de integración para flujos completos de comandos

