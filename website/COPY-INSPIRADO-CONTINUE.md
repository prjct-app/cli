# 🌐 prjct.app - Copy Inspirado en Continue.dev

---

## HEADLINE

> # Context that sticks.

o alternativa:

> # One sync. Every agent.

---

## FILOSOFÍA (Una línea)

> Your AI coding tools forget everything between sessions. prjct makes them remember.

---

## TRES COSAS (Máximo)

```
Sync      →  Detecta tu stack, genera contexto para Claude, Cursor, Gemini, Windsurf
Learn     →  Aprende tus patrones después de 3 usos
Focus     →  Filtra el ruido, carga solo lo relevante
```

---

## TERMINAL REAL

```bash
$ p. sync

Stack:   TypeScript + React + Hono
Agents:  frontend, backend, database
Learned: 12 patterns

Done.
```

---

## LO QUE ES

prjct es una CLI que sincroniza el contexto de tu proyecto para agentes de IA.

Un comando analiza tu código, detecta tu stack, genera archivos de contexto optimizados (CLAUDE.md, .cursorrules, GEMINI.md), y aprende tus preferencias con el uso.

Local. Open source. MIT.

---

## LO QUE NO ES

- No es un agente de IA
- No reemplaza a Claude/Cursor/Gemini
- No requiere cuenta ni servidor

---

## CÓMO FUNCIONA

```
Tu proyecto
    ↓
  prjct sync
    ↓
┌─────────────────────────────────────┐
│  CLAUDE.md  │  .cursorrules  │  ... │
└─────────────────────────────────────┘
    ↓
Tu agente entiende tu proyecto
```

---

## FLUJO DIARIO

```bash
# Sincroniza (una vez al día o cuando cambies algo importante)
$ p. sync

# Trabaja en una tarea
$ p. task "add user auth"

# Tu agente ya sabe: tu stack, tus patrones, tus preferencias

# Terminas
$ p. done

# Siguiente
$ p. next
```

---

## COMPATIBILIDAD

```
✓ Claude Code
✓ Cursor
✓ Gemini CLI
✓ Windsurf
✓ OpenCode
```

---

## OPEN SOURCE

```
License:      MIT
Repository:   github.com/...
Stars:        ...
```

El código hace lo que dice. Puedes leerlo.

---

## INSTALACIÓN

```bash
npm install -g prjct-cli
cd tu-proyecto
p. init
p. sync
```

30 segundos. Sin cuenta. Sin config.

---

## PRICING

```
Free        Todo lo core. 1 proyecto.
Pro $8/mo   Múltiples proyectos. Analytics. Integraciones.
Team $12    Sync entre equipo. Patrones compartidos.
```

---

## ESO ES TODO

prjct sincroniza contexto. Tu agente trabaja mejor. Fin.

---

# NOTAS DE DISEÑO

## Inspiración de Continue

| Continue | prjct |
|----------|-------|
| "Ship faster with Continuous AI" | "Context that sticks" |
| Delega lo aburrido | Recuerda lo importante |
| Cloud/CLI/IDE modes | Sync → Learn → Focus |
| Open source prominent | Open source prominent |

## Principios

1. **Menos es más** — Una página, no diez
2. **Terminal real** — No mockups, código que funciona
3. **Honestidad** — "Lo que no es" tan importante como "lo que es"
4. **Sin hype** — No "revolucionario", no "10x", no "mágico"

## Tono

- Directo
- Técnico pero no pretencioso
- Respeta la inteligencia del developer
- Deja que el producto hable
