---
allowed-tools: [Read, Write, Bash]
description: 'Initialize prjct project (with architect mode for blank projects)'
---

# /p:init

## Usage

```
/p:init                    # Existing project
/p:init "[idea]"          # New blank project (architect mode)
```

## Flow: Existing Project

1. Generate: project ID from path hash
2. Create: `~/.prjct-cli/projects/{id}/` structure (including `agents/`)
3. Write: `.prjct/prjct.config.json`
4. Run: `/p:analyze` to understand stack
5. Generate: agents based on stack
6. Log: `memory/context.jsonl`

## Flow: Blank Project (Architect Mode)

1. Generate: project ID
2. Activate: ARCHITECT role
3. Analyze: idea/requirements
4. Recommend: tech stack options (Next.js, React, Vue, etc.)
5. User confirms: choice
6. Create: directory structure + base files
7. Generate: initial roadmap
8. Generate: agents
9. Ask: "¿Empezamos con la primera feature?"

## Directory Structure

```
~/.prjct-cli/projects/{id}/
├── core/          # now.md, next.md, context.md
├── progress/      # shipped.md, metrics.md
├── planning/      # ideas.md, roadmap.md
├── analysis/      # repo-summary.md
├── agents/        # AI agent definitions
└── memory/        # context.jsonl
```

## Config Format

```json
{
  "version": "0.6.0",
  "projectId": "{id}",
  "dataPath": "~/.prjct-cli/projects/{id}",
  "author": {
    "name": "{from git}",
    "email": "{from git}",
    "github": "{from remote}"
  }
}
```

## Response: Existing Project

```
✅ prjct initialized!

📁 Data: ~/.prjct-cli/projects/{id}
📝 Config: .prjct/prjct.config.json
📊 Analysis: {stack_summary}
🤖 Agents: {N} agents generated

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 WHAT DO YOU WANT TO DO FIRST?
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Choose your path:

1. 🚀 Add a new feature
   Tell me what you want to build!

   Examples:
   • "add user authentication"
   • "implement dark mode"
   • "optimize performance"

   → /p:feature "{description}"

2. 🐛 Fix a bug
   Describe what's broken

   Example:
   • "login button not working"

   → /p:bug "{description}"

3. 🔍 Analyze deeper
   Discover TODOs and improvements

   → /p:analyze

4. 📊 See current status
   View what's in your project

   → /p:status (visual dashboard)
   → /p:recap (detailed overview)

5. 💡 Not sure yet?
   Get personalized suggestions

   → /p:suggest
   → /p:help

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 OR JUST TELL ME:

You can talk naturally:
  "I want to add authentication"
  "Help me fix this performance issue"
  "What should I do?"

I understand! No need to memorize commands.

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Let's ship something! 🚀
```

## Response: Blank Project

```
✅ prjct initialized!

📐 ARCHITECT MODE ACTIVATED

Your idea: "{idea}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎨 TECH STACK RECOMMENDATIONS:

Based on your idea, I recommend:

  ⭐ Option 1: Next.js + TypeScript + Tailwind
     → Best for: Full-stack apps, SEO, modern UI
     → Why: Fast, scalable, great DX

  Option 2: React + Vite + shadcn/ui
     → Best for: SPAs, rapid prototyping
     → Why: Lightweight, flexible

  Option 3: Vue 3 + Nuxt
     → Best for: Progressive apps, content sites
     → Why: Easy learning curve, performant

  Custom: Tell me your preference
     → Any stack works with prjct!

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Which option works for you? (1, 2, 3, or describe your choice)

[After user confirms:]

━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Structure created!

📁 Project: {path}
📦 Stack: {chosen_stack}
📋 Initial roadmap: {N} features
🤖 Agents: {N} specialists generated

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 WHAT'S NEXT?
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your roadmap is ready! You can:

1. 🚀 Start with first feature (RECOMMENDED)
   → /p:feature "{first_feature}"
   I'll break it down and we'll start building

2. 📊 See your roadmap
   → /p:roadmap
   View all planned features

3. 🔍 Review project structure
   → /p:recap
   See what was created

4. 💡 Modify the plan
   Just tell me:
   "I also want to add {feature}"
   "Let's do {different_feature} first"

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 REMEMBER:

You can talk naturally! Just tell me what you want:
  "Start with authentication"
  "Show me the roadmap"
  "I want to add another feature"

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ready to start building? 🚀
```
