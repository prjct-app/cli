# 🏗️ prjct.app - Landing Page Structure

## Page Sections (orden de scroll)

```
1. HERO          — Hook + CTA
2. SOCIAL PROOF  — Logos/stars (si hay)
3. PROBLEM       — Pain points (3 cards)
4. SOLUTION      — How it works (3 steps)
5. FEATURES      — Grid de features (6)
6. AGENTS        — Compatibilidad (logos)
7. WORKFLOW      — Diagrama visual
8. PRICING       — 3 tiers
9. TESTIMONIALS  — 3 quotes
10. CTA FINAL    — Install command
11. FOOTER       — Links
```

---

## Sección por Sección

### 1. HERO
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [Logo prjct]                    [Docs] [Pricing] [GitHub] [★]  │
│                                                                 │
│                                                                 │
│           Stop re-explaining your                               │
│           codebase to AI                                        │
│                                                                 │
│           prjct syncs your project context across               │
│           Claude Code, Cursor, Gemini CLI, and Windsurf.        │
│                                                                 │
│           [Get Started Free]  [See Demo →]                      │
│                                                                 │
│                                                                 │
│      ┌─────────────────────────────────────────────────┐        │
│      │  $ prjct sync                                   │        │
│      │  ✓ Detected: TypeScript + React + Hono         │        │
│      │  ✓ Generated: CLAUDE.md, CURSOR.md             │        │
│      │  ✓ Patterns: 23 extracted                      │        │
│      └─────────────────────────────────────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. AGENT LOGOS (Social proof alternativo)
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│      Works with:                                                │
│                                                                 │
│      [Claude]  [Cursor]  [Gemini]  [Windsurf]  [+more]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. PROBLEM (3 cards)
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│               The context problem costs you hours               │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   😤        │  │   📂        │  │   🔍        │             │
│  │  Context    │  │ Fragmented  │  │  Invisible  │             │
│  │   Loss      │  │  Knowledge  │  │    Work     │             │
│  │             │  │             │  │             │             │
│  │ 15 min cada │  │ README,head │  │ Patterns    │             │
│  │ sesión      │  │ slack,PRs   │  │ perdidos    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4. SOLUTION (3 steps)
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                  One sync. Universal context.                   │
│                                                                 │
│   ①                    ②                    ③                  │
│  Sync                 Work                 Learn                │
│                                                                 │
│  prjct sync      prjct task "..."      prjct done              │
│  ────────────    ─────────────────     ───────────             │
│  Analiza tu      Agent trabaja con     Patrones                │
│  codebase        contexto completo     guardados               │
│                                                                 │
│  [Terminal animation showing each step]                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5. FEATURES (grid 2x3)
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│            Everything you need. Nothing you don't.              │
│                                                                 │
│  ┌───────────────────┐  ┌───────────────────┐                  │
│  │ 🔄 Universal Sync │  │ 🧠 Continuous     │                  │
│  │                   │  │    Learning       │                  │
│  │ One sync, all     │  │ Project gets      │                  │
│  │ agents updated    │  │ smarter each day  │                  │
│  └───────────────────┘  └───────────────────┘                  │
│                                                                 │
│  ┌───────────────────┐  ┌───────────────────┐                  │
│  │ ⚡ Sub-second     │  │ 📊 Value          │                  │
│  │    Context        │  │    Dashboard      │                  │
│  │ <200ms load time  │  │ See your ROI      │                  │
│  └───────────────────┘  └───────────────────┘                  │
│                                                                 │
│  ┌───────────────────┐  ┌───────────────────┐                  │
│  │ 🔗 Linear         │  │ 🤖 Multi-Agent    │                  │
│  │    Integration    │  │    Output         │                  │
│  │ Issue → Code      │  │ Native formats    │                  │
│  └───────────────────┘  └───────────────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6. WORKFLOW (visual)
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              From idea to PR. No friction.                      │
│                                                                 │
│     [Linear]  ──▶  [prjct]  ──▶  [Agent]  ──▶  [Ship]          │
│        │             │             │             │              │
│     PRJ-123      Context       Coding          PR              │
│     assigned     injected      aware           merged          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7. PRICING
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                 Simple pricing. Start free.                     │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │    Dev      │  │    Pro      │  │    Team     │             │
│  │   Free      │  │  $8/mo      │  │ $12/seat/mo │             │
│  │             │  │             │  │             │             │
│  │ 1 project   │  │ Unlimited   │  │ Everything  │             │
│  │ Basic sync  │  │ Analytics   │  │ Team sync   │             │
│  │ 4 agents    │  │ Linear      │  │ Shared libs │             │
│  │             │  │ Custom      │  │ SSO         │             │
│  │             │  │             │  │             │             │
│  │ [Start]     │  │ [Trial]     │  │ [Contact]   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                    ↑ POPULAR                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8. TESTIMONIALS
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                  Developers love prjct                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ "I used to spend 15 minutes every session explaining  │     │
│  │  my stack. Now it just knows."                        │     │
│  │                                                       │     │
│  │  — Sarah Chen, Senior Developer                       │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  [Quote 2]                    [Quote 3]                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9. FINAL CTA
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│             Ready to stop repeating yourself?                   │
│                                                                 │
│     ┌─────────────────────────────────────────────────┐         │
│     │  npm install -g prjct-cli && prjct init        │ [Copy]  │
│     └─────────────────────────────────────────────────┘         │
│                                                                 │
│            [Get Started Free]    [Read Docs]                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack Recomendado

```
Framework:     Next.js 14+ (App Router)
Styling:       Tailwind CSS
Animations:    Framer Motion
Components:    shadcn/ui
Terminal:      Custom component con typewriter effect
Analytics:     Plausible (privacy-first)
Hosting:       Vercel
Domain:        prjct.app
```

---

## Páginas a Crear

```
/                 — Landing (este documento)
/pricing          — Pricing detallado + FAQ
/docs             — Documentación (puede ser /docs subdomain)
/blog             — Blog (puede ser separado)
/changelog        — Changelog
/login            — Auth (para dashboard)
/dashboard        — User dashboard (Pro+)
```

---

## Assets Necesarios

1. **Logo** — prjct wordmark + icon
2. **Agent logos** — Claude, Cursor, Gemini, Windsurf
3. **Terminal mockup** — Animated terminal component
4. **Workflow diagram** — SVG/animation
5. **OG Image** — 1200x630 para social sharing
6. **Favicon** — ico + apple-touch-icon
