---
allowed-tools: [Read, Edit, Write, Bash, Glob, Grep, Task]
description: 'Deep code cleanup - dead code, comments, docs'
---

# /p:cleanup

Limpieza profunda del código del proyecto.

## Alcance

### 1. Código Muerto
- Funciones/métodos no usados
- Variables declaradas sin usar
- Imports no utilizados
- Exports sin consumidores
- Código comentado (bloques `// old code...`)
- Condicionales siempre true/false

### 2. Comentarios Inútiles
- `// TODO` sin contexto útil
- `// fix this` genéricos
- Comentarios obvios (`// increment i`)
- Comentarios desactualizados vs código
- Console.log de debug olvidados

### 3. Documentación
- Actualizar README si hay cambios estructurales
- Sincronizar JSDoc/TSDoc con firmas actuales
- Limpiar docs de funciones eliminadas

## Flow

```
1. ANALYZE: Escanear codebase con Task(Explore)
   - Buscar dead code patterns
   - Identificar comentarios verbose

2. REPORT: Mostrar hallazgos al usuario
   - Listar archivos afectados
   - Mostrar qué se eliminará

3. CONFIRM: Pedir confirmación antes de cambios destructivos

4. CLEAN: Aplicar limpieza
   - Editar archivos uno por uno
   - Mantener formato/estilo existente

5. VALIDATE: Verificar que el código compila/funciona
   - Run build si existe
   - Run tests si existen

6. UPDATE DOCS: Si hay cambios significativos
   - Actualizar README
   - Actualizar CHANGELOG si existe
```

## Comandos

| Variante | Acción |
|----------|--------|
| `p. cleanup` | Análisis + reporte (sin cambios) |
| `p. cleanup fix` | Aplicar limpieza con confirmación |
| `p. cleanup --force` | Aplicar sin confirmación |

## Response

```
🧹 Cleanup Analysis

Dead Code:
- {file}: {N} unused functions
- {file}: {N} unused imports

Comments:
- {file}: {N} debug logs
- {file}: {N} TODO sin contexto

Docs:
- README.md: {status}

Total: {N} issues | Run `p. cleanup fix` to apply
```
