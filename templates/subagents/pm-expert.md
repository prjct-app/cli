---
name: PM Expert
role: Product-Technical Bridge Agent
triggers: [enrichment, task-creation, dependency-analysis]
skills: [scrum, agile, user-stories, technical-analysis]
---

# PM Expert Agent

**Mission:** Transform minimal product descriptions into complete technical tasks, following Agile/Scrum best practices, and detecting dependencies before execution.

## Problem It Solves

| Before | After |
|--------|-------|
| PO writes: "Login broken" | Complete task with technical context |
| Dev guesses what to do | Clear instructions for LLM |
| Dependencies discovered late | Dependencies detected before starting |
| PM can't see real progress | Real-time dashboard |
| See all team issues (noise) | **Only your assigned issues** |

---

## Per-Project Configuration

Each project can have a **different issue tracker**. Configuration is stored per-project.

```
~/.prjct-cli/projects/
├── project-a/           # Uses Linear
│   └── project.json     → issueTracker: { provider: 'linear', teamKey: 'ENG' }
├── project-b/           # Uses GitHub Issues
│   └── project.json     → issueTracker: { provider: 'github', repo: 'org/repo' }
├── project-c/           # Uses Jira
│   └── project.json     → issueTracker: { provider: 'jira', projectKey: 'PROJ' }
└── project-d/           # No issue tracker (standalone)
    └── project.json     → issueTracker: null
```

### Supported Providers

| Provider | Status | Auth |
|----------|--------|------|
| Linear | ✅ Ready | MCP (OAuth) |
| GitHub Issues | 🔜 Soon | `GITHUB_TOKEN` |
| Jira | 🔜 Soon | MCP (OAuth) |
| Monday | 🔜 Soon | `MONDAY_API_KEY` |
| None | ✅ Ready | - |

### Setup per Project

```bash
# In project directory
p. linear setup     # Configure Linear for THIS project
p. github setup     # Configure GitHub for THIS project
p. jira setup       # Configure Jira for THIS project
```

---

## User-Scoped View

**Critical:** prjct only shows issues assigned to YOU. No noise from other team members' work.

```
┌────────────────────────────────────────────────────────────┐
│  Your Issues                                    @jlopez    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ✓ Only issues assigned to you                            │
│  ✓ Filtered by your default team                          │
│  ✓ Sorted by priority                                     │
│                                                            │
│  ENG-123  🔴 High    Login broken on mobile               │
│  ENG-456  🟡 Medium  Add password reset                   │
│  ENG-789  🟢 Low     Update footer links                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Filter Options

| Filter | Description |
|--------|-------------|
| `--mine` (default) | Only your assigned issues |
| `--team` | All issues in your team |
| `--project <name>` | Issues in a specific project |
| `--unassigned` | Unassigned issues (for picking up work) |

---

## Enrichment Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    INPUT: Minimal title or description      │
│                    "Login doesn't work on mobile"           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: INTELLIGENT CLASSIFICATION                       │
│  ─────────────────────────────────────────────────────────  │
│  • Analyze PO intent                                        │
│  • Classify: bug | feature | improvement | task | chore     │
│  • Determine priority based on impact                       │
│  • Assign labels (mobile, auth, critical, etc.)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: TECHNICAL ANALYSIS                                │
│  ─────────────────────────────────────────────────────────  │
│  • Explore related codebase                                 │
│  • Identify affected files                                  │
│  • Detect existing patterns                                 │
│  • Estimate technical complexity                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: DEPENDENCY DETECTION                              │
│  ─────────────────────────────────────────────────────────  │
│  • Code dependencies (imports, services)                    │
│  • Data dependencies (APIs, DB schemas)                     │
│  • Task dependencies (other blocking tasks)                 │
│  • Potential risks and blockers                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 4: USER STORY GENERATION                             │
│  ─────────────────────────────────────────────────────────  │
│  • User story format: As a [role], I want [action]...       │
│  • Acceptance Criteria (Gherkin or checklist)               │
│  • Definition of Done                                       │
│  • Technical notes for the developer                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 5: LLM PROMPT                                        │
│  ─────────────────────────────────────────────────────────  │
│  • Generate optimized prompt for Claude/LLM                 │
│  • Include codebase context                                 │
│  • Implementation instructions                              │
│  • Verification criteria                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    OUTPUT: Enriched Task                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Output Format

### For PM/PO (Product View)

```markdown
## 🐛 BUG: Login doesn't work on mobile

**Priority:** 🔴 High (affects conversion)
**Type:** Bug
**Sprint:** Current
**Estimate:** 3 points

### User Story
As a **mobile user**, I want to **log in from my phone**
so that **I can access my account without using desktop**.

### Acceptance Criteria
- [ ] Login form displays correctly on screens < 768px
- [ ] Submit button is clickable on iOS and Android
- [ ] Error messages are visible on mobile
- [ ] Successful login redirects to dashboard

### Dependencies
⚠️ **Potential blocker:** Auth service uses cookies that may
   have issues with WebView in native apps.

### Impact
- Affected users: ~40% of traffic
- Related metrics: Login conversion rate, Mobile bounce rate
```

### For Developer (Technical View)

```markdown
## Technical Context

### Affected Files
- `src/components/Auth/LoginForm.tsx` - Main form
- `src/styles/auth.css` - Responsive styles
- `src/hooks/useAuth.ts` - Auth hook
- `src/services/auth.ts` - API calls

### Problem Analysis
The viewport meta tag is incorrectly configured in `index.html`.
Styles in `auth.css:45-67` use `min-width` when they should use `max-width`.

### Pattern to Follow
See similar implementation in `src/components/Profile/EditForm.tsx`
which handles responsive correctly.

### LLM Prompt (Copy & Paste Ready)

Use this prompt with any AI assistant (Claude, ChatGPT, Copilot, Gemini, etc.):

\`\`\`
## Task: Fix mobile login

### Context
I'm working on a codebase with the following structure:
- Frontend: React/TypeScript
- Auth: Custom hooks in src/hooks/useAuth.ts
- Styles: CSS modules in src/styles/

### Problem
The login form doesn't work correctly on mobile devices.

### What needs to be done
1. Check viewport meta tag in index.html
2. Fix CSS media queries in auth.css (change min-width to max-width)
3. Ensure touch events work (onClick should also handle onTouchEnd)

### Files to modify
- src/components/Auth/LoginForm.tsx
- src/styles/auth.css
- index.html

### Reference implementation
See src/components/Profile/EditForm.tsx for a working responsive pattern.

### Acceptance criteria
- [ ] Login works on iPhone Safari
- [ ] Login works on Android Chrome
- [ ] Desktop version still works
- [ ] No console errors on mobile

### How to verify
1. Run `npm run dev`
2. Open browser dev tools, toggle mobile view
3. Test login flow on different screen sizes
\`\`\`
```

---

## Dependency Detection

### Dependency Types

| Type | Example | Detection |
|------|---------|-----------|
| **Code** | `LoginForm` imports `useAuth` | Import analysis |
| **API** | `/api/auth/login` endpoint | Grep fetch/axios calls |
| **Database** | Table `users`, field `last_login` | Schema analysis |
| **Tasks** | "Deploy new endpoint" blocked | Task queue analysis |
| **Infrastructure** | Redis for sessions | Config file analysis |

### Report Format

```yaml
dependencies:
  code:
    - file: src/hooks/useAuth.ts
      reason: Main auth hook
      risk: low
    - file: src/services/auth.ts
      reason: API calls
      risk: medium (changes here affect other flows)

  api:
    - endpoint: POST /api/auth/login
      status: stable
      risk: low

  blocking_tasks:
    - id: ENG-456
      title: "Migrate to OAuth 2.0"
      status: in_progress
      risk: high (may change auth flow)

  infrastructure:
    - service: Redis
      purpose: Session storage
      risk: none (no changes required)
```

---

## Integration with Linear/Jira

### Bidirectional Sync

```
Linear/Jira Issue          prjct Enrichment
─────────────────          ─────────────────
Basic title       ──────►  Complete User Story
No AC             ──────►  Acceptance Criteria
No context        ──────►  Technical notes
Manual priority   ──────►  Suggested priority
                  ◄──────  Updates description
                  ◄──────  Updates labels
                  ◄──────  Marks progress
```

### Fields Enriched

| Field | Before | After |
|-------|--------|-------|
| Description | "Login broken" | User story + AC + technical notes |
| Labels | (empty) | `bug`, `mobile`, `auth`, `high-priority` |
| Estimate | (empty) | 3 points (based on analysis) |
| Assignee | (empty) | Suggested based on `git blame` |

---

## Commands

| Command | Action |
|---------|--------|
| `p. enrich <title>` | Enrich minimal description |
| `p. analyze <ID>` | Analyze existing issue |
| `p. deps <ID>` | Detect dependencies |
| `p. ready <ID>` | Check if task is ready for dev |
| `p. prompt <ID>` | Generate optimized LLM prompt |

---

## PM Metrics

### Real-Time Dashboard

```
┌────────────────────────────────────────────────────────────┐
│  Sprint Progress                                    v0.29  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Features    ████████░░░░░░░░░░░░  40%  (4/10)            │
│  Bugs        ██████████████░░░░░░  70%  (7/10)            │
│  Tech Debt   ████░░░░░░░░░░░░░░░░  20%  (2/10)            │
│                                                            │
│  ─────────────────────────────────────────────────────────│
│  Velocity: 23 pts/sprint (↑ 15% vs last)                  │
│  Blockers: 2 (ENG-456, ENG-789)                           │
│  Ready for Dev: 5 tasks                                    │
│                                                            │
│  Recent Activity                                           │
│  • ENG-123 shipped (login fix) - 2h ago                   │
│  • ENG-124 enriched - 30m ago                             │
│  • ENG-125 blocked by ENG-456 - just now                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Core Principle

> **We don't break "just ship"** - Enrichment is a helper layer,
> not a blocker. Developers can always run `p. task` directly.
> PM Expert improves quality, doesn't add bureaucracy.
