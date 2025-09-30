# 🚀 prjct-cli

**AI-integrated project management for indie hackers** - Ship fast, stay focused, no ceremonies.

Works with **Claude Code**, **OpenAI Codex/GitHub OpenAI Codex**, and **Warp Terminal**.

[![OpenAI Codex Compatible](https://img.shields.io/badge/OpenAI%20Codex-Compatible-00a67e)](AGENTS.md)
[![Claude Code Ready](https://img.shields.io/badge/Claude%20Code-Ready-6366f1)](CLAUDE.md)

## 🤖 Intelligent Agent Detection

**prjct-cli automatically detects and adapts to your environment** - No configuration needed!

The system intelligently identifies whether you're using:

- **Claude Code** → Rich markdown, MCP integration, interactive features
- **OpenAI Codex** → Structured output for sandboxed environments
- **Terminal/CLI** → ANSI colors, progress spinners, native experience

### How It Works

```javascript
// Automatic detection strategies:
1. Environment Variables (CLAUDE_AGENT, CODEX_AGENT)
2. Configuration Files (AGENTS.md, CLAUDE.md)
3. Runtime Capabilities (MCP availability)
4. Filesystem Characteristics (sandboxed paths)
```

Each agent gets optimized output:

- **Claude**: `✅ **Task complete!** Ready for the next challenge?`
- **Codex**: `[SUCCESS] Task complete. NEXT: Use /p:next`
- **Terminal**: `✅ Task complete! → Use prjct next`

## ⚡ Installation

### Option 1: Quick Install (Recommended)

```bash
curl -fsSL https://prjct.app/install.sh | bash
```

### Option 2: Clone from GitHub

```bash
git clone https://github.com/jlopezlira/prjct-cli
cd prjct-cli
./setup.sh
```

> The installer will:
>
> - Install to `~/.prjct-cli/`
> - Configure AI assistant integration (MCP)
> - Set up the `prjct` command
> - Create project structure in `.prjct/`
> - Auto-detect your environment (Claude/Codex/Terminal)

## 🗑️ Uninstallation

To completely remove prjct-cli from your system:

```bash
cd ~/.prjct-cli
./uninstall.sh
```

The uninstaller will:

- **Safely remove** all prjct-cli components
- **Offer options** for your project data:
  - Keep all `.prjct/` directories (recommended)
  - Back up before removal
  - Permanently delete (requires confirmation)
- **Clean up** shell configuration and paths
- **Remove** Claude Code commands

> ⚠️ **WARNING**: Uninstallation is irreversible. The script will ask for confirmation before removing anything.

## 📱 Platform Usage

### Claude Code

```
# Core Commands
/p:init                    # Initialize project
/p:now "implement auth"    # Set current task
/p:done                    # Complete task
/p:ship "authentication"   # Ship feature
/p:recap                   # Show progress

# New Power Commands 🚀
/p:analyze                 # Auto-analyze codebase
/p:git                     # Smart git commit & push
/p:fix "error msg"         # Quick troubleshooting
/p:test                    # Run & fix tests
/p:task "complex feature"  # Break down & execute
/p:roadmap                 # Strategic planning
```

### OpenAI Codex / GitHub OpenAI Codex

The repository includes `AGENTS.md` for full OpenAI Codex compatibility.

```
# Codex automatically reads AGENTS.md for guidance
/p:init                    # Creates .prjct/ structure
/p:now "add API endpoint"  # Updates current focus
/p:ship "REST API"         # Celebrates shipped feature
/p:progress week           # Shows weekly metrics
/p:context                 # Show project context
/p:recap                   # Display project overview
```

> **Setup**: Authorize the Codex GitHub app for your organization, and Codex will automatically detect the AGENTS.md configuration.

### Warp Terminal

```bash
prjct init                 # Initialize project
prjct now "implement auth"  # Set current task
prjct done                 # Complete task
prjct ship "authentication" # Ship feature
prjct recap                # Show progress
```

> Warp AI also understands `/p:` commands in the terminal

## 🎯 ¿Qué Comando Usar Cuando...?

### 🆕 **"Tengo una nueva idea o feature no planeada"**

```bash
# Opción 1: Solo capturar la idea para no olvidarla
/p:idea "agregar modo oscuro al dashboard"
→ 💡 Se guarda en ideas.md para revisar después

# Opción 2: Agregarla al roadmap para planificarla
/p:roadmap add "implementar modo oscuro"
→ 📋 Se prioriza automáticamente en el roadmap

# Opción 3: Empezar a trabajar en ella AHORA
/p:now "implementar modo oscuro en dashboard"
→ 🎯 Se establece como tu tarea actual (solo puedes tener UNA)
```

### ✅ **"Terminé lo que estaba haciendo"**

```bash
# Marcar tarea como completada
/p:done
→ ✅ Limpia tu foco actual y sugiere la siguiente tarea

# Si es una feature importante, CELEBRARLA
/p:ship "sistema de autenticación OAuth"
→ 🚀 Se registra como un WIN con celebración 🎉
```

### 🤔 **"No sé qué hacer" o "¿En qué estaba?"**

```bash
/p:recap
→ 📊 Muestra TODO: tarea actual, progreso, shipped, roadmap

/p:next
→ 📋 Muestra tu cola de tareas priorizadas

/p:context
→ 📚 Info del proyecto y acciones recientes
```

### 🆘 **"Estoy atorado con un problema"**

```bash
/p:stuck "CORS error en API calls"
→ 💡 Soluciones contextuales basadas en tu proyecto

/p:fix "TypeError: undefined is not a function"
→ 🔧 Auto-diagnóstico y posibles soluciones
```

### 📊 **"Quiero ver mi progreso"**

```bash
/p:progress week
→ 📈 Métricas semanales: shipped, velocidad, trends

/p:progress month
→ 📊 Vista mensual con estadísticas detalladas
```

### 🧹 **"Necesito limpiar el código"**

```bash
/p:cleanup
→ 🧹 Limpieza básica de archivos temporales y logs

/p:cleanup-advanced --type code
→ 🗑️ Elimina console.logs, código comentado, imports sin usar

/p:cleanup-advanced --aggressive
→ ⚡ Limpieza profunda con optimización de dependencias
```

### 🎨 **"Necesito diseñar antes de codear"**

```bash
/p:design "sistema de autenticación" --type architecture
→ 🏗️ Genera diseño de arquitectura con diagramas ASCII

/p:design "API de usuarios" --type api
→ 📋 Diseña endpoints REST/GraphQL con especificaciones

/p:design "dashboard" --type component
→ 🧩 Diseña jerarquía de componentes UI

/p:design "base de datos" --type database
→ 📊 Diseña esquemas y relaciones de base de datos
```

### 💻 **"Necesito hacer commit/push"**

```bash
/p:git
→ 📝 Genera mensaje inteligente y hace commit

/p:git push
→ 🚀 Commit + push a origin

/p:git sync
→ 🔄 Pull + commit + push (sincronización completa)
```

## 📖 Referencia Completa de Comandos

### Comandos Core (Esenciales) 🎯

| Comando             | ¿Cuándo usarlo?                | ¿Qué hace?                         | Output Ejemplo                            |
| ------------------- | ------------------------------ | ---------------------------------- | ----------------------------------------- |
| `/p:init`           | Al empezar un nuevo proyecto   | Crea estructura `.prjct/` completa | `✅ Project initialized!`                 |
| `/p:now [task]`     | Para establecer tu foco actual | Define UNA sola tarea activa       | `🎯 Current: implement auth`              |
| `/p:done`           | Al terminar tu tarea actual    | Marca como completa y limpia foco  | `✅ Task complete! Next: API integration` |
| `/p:ship <feature>` | Al completar algo importante   | Celebra y registra el WIN          | `🚀 SHIPPED: User auth! 🎉`               |
| `/p:recap`          | Para ver overview completo     | Muestra progreso y estado actual   | `📊 3 shipped, 1 active, 5 queued`        |

### Comandos de Planificación 📋

| Comando             | ¿Cuándo usarlo?          | ¿Qué hace?                     | Output Ejemplo                 |
| ------------------- | ------------------------ | ------------------------------ | ------------------------------ |
| `/p:idea <text>`    | Cuando se te ocurre algo | Captura rápida sin interrumpir | `💡 Idea captured!`            |
| `/p:roadmap`        | Ver plan estratégico     | Muestra roadmap completo       | `🚀 Sprint: 23% complete`      |
| `/p:roadmap add`    | Agregar nueva feature    | Prioriza automáticamente       | `✅ Added: Priority #3`        |
| `/p:next`           | Ver qué sigue            | Lista tareas priorizadas       | `1. Fix auth bug 2. Add tests` |
| `/p:task <complex>` | Desglosar tarea compleja | Divide en subtareas manejables | `📋 Split into 5 subtasks`     |

### Comandos de Desarrollo 🛠️

| Comando          | ¿Cuándo usarlo?      | ¿Qué hace?                   | Output Ejemplo                  |
| ---------------- | -------------------- | ---------------------------- | ------------------------------- |
| `/p:analyze`     | Entender el proyecto | Análisis automático del repo | `🔍 Tech: Node.js, 45 files`    |
| `/p:git`         | Hacer commit rápido  | Mensaje inteligente + commit | `✅ feat: add auth system`      |
| `/p:test`        | Ejecutar tests       | Run + auto-fix simple errors | `✅ 42 passing, 2 fixed`        |
| `/p:fix <error>` | Resolver errores     | Diagnóstico y soluciones     | `🔧 Solution: check null first` |

### Comandos de Métricas 📊

| Comando            | ¿Cuándo usarlo?        | ¿Qué hace?               | Output Ejemplo                    |
| ------------------ | ---------------------- | ------------------------ | --------------------------------- |
| `/p:progress`      | Ver productividad      | Métricas de la semana    | `📈 7 shipped, velocity: 1.4/day` |
| `/p:context`       | Info del proyecto      | Estado actual y contexto | `📚 Sprint 3, Day 12, 67% done`   |
| `/p:stuck <issue>` | Cuando necesitas ayuda | Soluciones contextuales  | `💡 Try: npm install cors`        |

## 🔄 Flujos de Trabajo Completos

### 🌟 **Mi Primer Día con prjct**

```bash
# 1. Inicializar estructura
/p:init
→ ✅ Proyecto configurado con estructura .prjct/

# 2. Analizar el repositorio
/p:analyze
→ 🔍 Detectado: Node.js, React, 45 archivos

# 3. Ver o crear roadmap
/p:roadmap
→ 📋 Roadmap vacío, usa /p:roadmap add

# 4. Establecer primera tarea
/p:now "configurar entorno de desarrollo"
→ 🎯 Foco actual establecido

# 5. Al terminar, celebrar
/p:done
→ ✅ Tarea completada

/p:ship "environment configured"
→ 🚀 First WIN recorded! 🎉
```

### 💼 **Daily Work Session**

```bash
# Morning: See where I am
/p:recap
→ 📊 Overview: 1 active, 3 in queue, 5 shipped this week

# Confirm or change focus
/p:now
→ 🎯 Current: implement payment system

# During work
/p:stuck "Stripe webhook not working"
→ 💡 Solution: Verify endpoint URL and secrets

/p:idea "add transaction logs"
→ 💡 Idea saved for later

# At end of day
/p:done
→ ✅ Payment system completed

/p:git
→ 📝 Commit: feat: add Stripe payment system

/p:progress
→ 📈 Today: 1 shipped, velocity maintaining
```

### 🏗️ **Complex Feature Management**

```bash
# 1. Break down the large feature
/p:task "complete notification system"
→ 📋 Broken down into 5 subtasks:
   [1/5] Design event architecture
   [2/5] Implement WebSockets
   [3/5] Create notification UI
   [4/5] User preference system
   [5/5] Testing and documentation

# 2. Work on each subtask
/p:now "design event architecture"
→ 🎯 Subtask 1 active

# 3. Complete one by one
/p:done
→ ✅ Subtask 1 complete, next: WebSockets

/p:now "implement WebSockets"
→ 🎯 Subtask 2 active

# 4. When all complete, celebrate big
/p:ship "complete notification system"
→ 🚀 MEGA WIN: Notification system complete! 🎉🎊
```

### 🚀 **Sprint Planning con Roadmap**

```bash
# View current roadmap
/p:roadmap
→ 📋 Current sprint: 45% completed

# Add new prioritized features
/p:roadmap add "two-factor authentication"
→ ✅ Added as priority #2

/p:roadmap add "Slack integration"
→ ✅ Added as priority #5

# Complete roadmap items
/p:roadmap complete "payment system"
→ ✅ Marked as completed, progress: 67%

# View next priority
/p:roadmap next
→ 📍 Next: two-factor authentication
```

## ❓ FAQ - Frequently Asked Questions

### **"What happens if I use `/p:now` without finishing the previous task?"**

The previous task gets REPLACED. prjct uses a "single focus" philosophy - only ONE active task at a time. If you need to switch context, use `/p:done` first.

### **"Can I work on multiple tasks simultaneously?"**

NO by design. prjct forces focus on a single task. If you need to temporarily switch, use `/p:done` and then `/p:now` with the new task.

### **"What's the difference between `/p:done` and `/p:ship`?"**

- `/p:done` = Complete current task and clear focus
- `/p:ship` = Celebrate an important FEATURE (not all tasks are features)

```bash
/p:done                    # "I finished fixing that bug"
/p:ship "new dashboard"    # "LAUNCHED THE NEW DASHBOARD!" 🎉
```

### **"How do I modify something in the roadmap?"**

```bash
/p:roadmap                 # View everything
/p:roadmap add "feature"   # Add new
/p:roadmap complete "item" # Mark as done
/p:roadmap next           # View next priority
```

### **"Can I undo a command?"**

There's no automatic "undo", but you can:

- Manually edit files in `.prjct/`
- Use `/p:now` to change current task
- Files are simple markdown, easy to edit

### **"What happens with my data?"**

- EVERYTHING is stored locally in `.prjct/`
- No data leaves your machine
- You can version `.prjct/` with git if you want
- Backup = copy the `.prjct/` folder

### **"How do I migrate from Jira/Trello/etc?"**

You don't need to migrate anything. Simply:

```bash
/p:init                           # Start fresh
/p:roadmap add "current feature"  # Add what you're working on
/p:now "today's task"            # Start working
```

### **"Does it work with teams?"**

prjct is designed for indie hackers and solopreneurs. For teams, each developer can have their own `.prjct/` or share one via git.

### **"Can I customize the commands?"**

Commands are standardized to maintain simplicity. But files in `.prjct/` are markdown - you can edit them however you want.

## 📂 File Structure

### New Layered Architecture 🏗️

```
.prjct/
├── 🎯 core/        # Current focus & priorities
│   ├── now.md      # Current task
│   ├── next.md     # Priority queue
│   └── context.md  # Project context
├── 📈 progress/    # Metrics & achievements
│   ├── shipped.md  # Completed features
│   └── metrics.md  # Velocity & stats
├── 💡 planning/    # Ideas & strategy
│   ├── ideas.md    # Brain dump
│   ├── roadmap.md  # Strategic planning
│   └── tasks/      # Complex task plans
├── 🔍 analysis/    # Technical insights
│   └── repo-summary.md  # Auto-generated
└── 🧠 memory/      # History & learning
    ├── context.jsonl     # Activity log
    └── decisions.jsonl   # Decision history
```

### Migration from Old Structure

If you have an existing flat `.prjct/` structure, run:

```bash
./migrate.sh  # Automatic migration to layered structure
```

## 🎨 Philosophy

- **Zero friction**: Commands within your existing workflow
- **Single task focus**: One thing at a time
- **Celebration built-in**: Every ship is a win
- **No ceremonies**: No sprints, no story points, no meetings

## 📊 What We Track

✅ **Features shipped** - The only metric that matters
✅ **Current focus** - Stay on track
✅ **Ideas captured** - Never lose a thought
❌ ~~Story points~~ - We ship, not estimate
❌ ~~Hours logged~~ - Focus on outcomes
❌ ~~Burndown charts~~ - Ship and celebrate

## 🛠️ Requirements

- Node.js 18+
- One of: Claude Code, OpenAI Codex, Cursor, VS Code, or Warp Terminal

### AI Assistant Configuration

- **OpenAI Codex**: AGENTS.md file (included)
- **Claude Code**: CLAUDE.md file (included)
- **Warp Terminal**: Shell integration (via setup.sh)

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](docs/Developer-Guide/contributing.md).

## 📜 License

MIT - Build something amazing!

---

**Built for builders who ship, not managers who meet.**
