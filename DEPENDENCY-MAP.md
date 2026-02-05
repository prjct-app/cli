# MCP Server Pivot - Dependency Map & Execution Order

## Overview

**Total Tickets**: 32 (22 main + 10 subtasks)
**Estimated Points**: 52
**Timeline**: 5 weeks

---

## Execution Order (No Blockers)

This is the **critical path** - the order in which tickets can be worked on without waiting.

### Phase 1: Foundation (Week 1)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  START HERE - NO BLOCKERS                                                   │
│                                                                             │
│  PRJ-154 [Setup] Initialize TypeScript project with MCP SDK                 │
│  ├── Effort: S (1pt)                                                        │
│  └── Can start immediately                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PARALLEL AFTER PRJ-154                                                     │
│                                                                             │
│  PRJ-155 [Setup] Configure Supabase project and database schema             │
│  ├── Effort: M (2pt)                                                        │
│  └── Blocked by: PRJ-154                                                    │
│                                                                             │
│  PRJ-156 [Setup] Implement base MCP Server with Streamable HTTP             │
│  ├── Effort: M (2pt)                                                        │
│  └── Blocked by: PRJ-154                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AFTER PRJ-155 + PRJ-156                                                    │
│                                                                             │
│  PRJ-157 [Setup] Implement JWT authentication middleware                    │
│  ├── Effort: M (2pt)                                                        │
│  └── Blocked by: PRJ-155, PRJ-156                                           │
│                                                                             │
│  PRJ-169 [Improvement] Error handling and response standardization          │
│  ├── Effort: M (2pt)                                                        │
│  └── Blocked by: PRJ-156                                                    │
│                                                                             │
│  PRJ-167 [Feature] Events pipeline for realtime dashboard                   │
│  ├── Effort: M (2pt)                                                        │
│  └── Blocked by: PRJ-155                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AFTER PRJ-157                                                              │
│                                                                             │
│  PRJ-158 [Setup] Deploy to Vercel Edge                                      │
│  ├── Effort: S (1pt)                                                        │
│  └── Blocked by: PRJ-157                                                    │
│                                                                             │
│  PRJ-168 [Feature] Implement rate limiting per pricing tier                 │
│  ├── Effort: M (2pt)                                                        │
│  └── Blocked by: PRJ-157                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 2: Core Tools (Week 2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PARALLEL AFTER PRJ-155 + PRJ-156                                           │
│                                                                             │
│  PRJ-159 [Feature] Implement prjct_get_state tool                           │
│  ├── Effort: M (2pt)                                                        │
│  └── Blocked by: PRJ-155, PRJ-156                                           │
│                                                                             │
│  PRJ-164 [Feature] Implement prjct_log_decision tool                        │
│  ├── Effort: M (2pt)                                                        │
│  └── Blocked by: PRJ-155, PRJ-156                                           │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AFTER PRJ-159                                                              │
│                                                                             │
│  PRJ-160 [Feature] Implement prjct_start_task tool                          │
│  ├── Effort: M (2pt)                                                        │
│  └── Blocked by: PRJ-159                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PARALLEL AFTER PRJ-160                                                     │
│                                                                             │
│  PRJ-161 [Feature] Implement prjct_complete_task tool                       │
│  ├── Effort: S (1pt)                                                        │
│  └── Blocked by: PRJ-160                                                    │
│                                                                             │
│  PRJ-162 [Feature] Implement prjct_pause_task / prjct_resume_task           │
│  ├── Effort: S (1pt)                                                        │
│  └── Blocked by: PRJ-160                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AFTER PRJ-159 + PRJ-164                                                    │
│                                                                             │
│  PRJ-165 [Feature] Implement prjct_get_context tool                         │
│  ├── Effort: L (3pt)                                                        │
│  └── Blocked by: PRJ-159, PRJ-164                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 3: Testing & Integration (Week 3)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AFTER PRJ-161 + PRJ-162                                                    │
│                                                                             │
│  PRJ-163 [Test] Unit tests for core tools                                   │
│  ├── Effort: L (3pt)                                                        │
│  ├── Blocked by: PRJ-161, PRJ-162                                           │
│  └── Subtasks:                                                              │
│      ├── PRJ-183 Setup Vitest with mock utilities (1pt)                     │
│      ├── PRJ-184 Write tests for prjct_get_state (1pt) ← blocks: PRJ-183    │
│      └── PRJ-185 Write tests for task operations (2pt) ← blocks: PRJ-183    │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AFTER PRJ-160 + PRJ-161                                                    │
│                                                                             │
│  PRJ-166 [Feature] Implement prjct_linear_sync tool                         │
│  ├── Effort: L (3pt)                                                        │
│  ├── Blocked by: PRJ-160, PRJ-161                                           │
│  └── Subtasks:                                                              │
│      ├── PRJ-180 Linear OAuth flow and token management (2pt)               │
│      ├── PRJ-181 Linear push - create/update issues (1pt) ← blocks: PRJ-180 │
│      └── PRJ-182 Linear pull - sync status changes (1pt) ← blocks: PRJ-180  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 4: Polish & Docs (Week 4)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AFTER PRJ-163 + PRJ-166                                                    │
│                                                                             │
│  PRJ-171 [Test] Integration tests with real MCP clients                     │
│  ├── Effort: L (3pt)                                                        │
│  └── Blocked by: PRJ-163, PRJ-166                                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  AFTER PRJ-158                                                              │
│                                                                             │
│  PRJ-170 [Docs] Setup documentation for Claude, Cursor, VS Code             │
│  ├── Effort: M (2pt)                                                        │
│  └── Blocked by: PRJ-158                                                    │
│                                                                             │
│  PRJ-174 [Ops] Monitoring and alerting setup                                │
│  ├── Effort: S (1pt)                                                        │
│  └── Blocked by: PRJ-158                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 5: Dashboard & Launch (Week 5)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AFTER PRJ-155 + PRJ-167                                                    │
│                                                                             │
│  PRJ-172 [Feature] Dashboard MVP - realtime activity view                   │
│  ├── Effort: XL (5pt)                                                       │
│  ├── Blocked by: PRJ-167, PRJ-155                                           │
│  └── Subtasks:                                                              │
│      ├── PRJ-176 Create Next.js project with Supabase Auth (1pt)            │
│      ├── PRJ-177 Implement ActivityFeed with Realtime (2pt) ← blocks: 176   │
│      ├── PRJ-178 Implement ActiveTask with live duration (1pt) ← blocks: 176│
│      └── PRJ-179 Deploy to Vercel (1pt) ← blocks: PRJ-177, PRJ-178          │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AFTER PRJ-172                                                              │
│                                                                             │
│  PRJ-173 [Docs] Landing page updates for prjct.app                          │
│  ├── Effort: M (2pt)                                                        │
│  └── Blocked by: PRJ-172                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FINAL - AFTER ALL                                                          │
│                                                                             │
│  PRJ-175 [Launch] Public beta release                                       │
│  ├── Effort: S (1pt)                                                        │
│  └── Blocked by: PRJ-171, PRJ-172, PRJ-173, PRJ-174                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Visual Dependency Graph

```
                                PRJ-154
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              │
                PRJ-155        PRJ-156            │
                    │              │              │
         ┌─────────┼─────────┐    │              │
         │         │         │    │              │
         ▼         ▼         ▼    ▼              │
     PRJ-167   PRJ-159   PRJ-164  PRJ-169        │
         │         │         │                   │
         │         ▼         │                   │
         │     PRJ-160◄──────┘                   │
         │         │                             │
         │    ┌────┴────┐                        │
         │    ▼         ▼                        │
         │ PRJ-161   PRJ-162                     │
         │    │         │                        │
         │    └────┬────┘                        │
         │         │                             │
         │    ┌────┼────┐                        │
         │    ▼    ▼    ▼                        │
         │ PRJ-163 PRJ-166 PRJ-165              │
         │    │      │                          │
         │    └──────┼──────────────────────────┤
         │           ▼                          │
         │       PRJ-171                        │
         │           │                          │
         │           │    ┌─────────────────────┘
         │           │    │
         │           │    ▼
         │           │ PRJ-157
         │           │    │
         │           │    ├────────┬────────┐
         │           │    ▼        ▼        ▼
         │           │ PRJ-158  PRJ-168  PRJ-170
         │           │    │                 │
         │           │    │                 │
         │           │    ├─────────────────┤
         │           │    ▼                 │
         │           │ PRJ-174              │
         │           │    │                 │
         ▼           │    │                 │
     PRJ-172◄────────┘    │                 │
         │                │                 │
         ▼                │                 │
     PRJ-173              │                 │
         │                │                 │
         └────────────────┼─────────────────┘
                          ▼
                      PRJ-175
                       (LAUNCH)
```

---

## Ticket Summary by Category

### Setup (5 tickets, 8 points)
| ID | Title | Points | Blocked By |
|----|-------|--------|------------|
| PRJ-154 | Initialize TypeScript project | 1 | - |
| PRJ-155 | Configure Supabase schema | 2 | PRJ-154 |
| PRJ-156 | Implement MCP Server base | 2 | PRJ-154 |
| PRJ-157 | Implement JWT auth middleware | 2 | PRJ-155, PRJ-156 |
| PRJ-158 | Deploy to Vercel Edge | 1 | PRJ-157 |

### Core Tools (6 tickets, 10 points)
| ID | Title | Points | Blocked By |
|----|-------|--------|------------|
| PRJ-159 | prjct_get_state | 2 | PRJ-155, PRJ-156 |
| PRJ-160 | prjct_start_task | 2 | PRJ-159 |
| PRJ-161 | prjct_complete_task | 1 | PRJ-160 |
| PRJ-162 | prjct_pause/resume_task | 1 | PRJ-160 |
| PRJ-164 | prjct_log_decision | 2 | PRJ-155, PRJ-156 |
| PRJ-165 | prjct_get_context | 3 | PRJ-159, PRJ-164 |

### Integration (4 tickets, 7 points)
| ID | Title | Points | Blocked By |
|----|-------|--------|------------|
| PRJ-166 | prjct_linear_sync (parent) | 3 | PRJ-160, PRJ-161 |
| PRJ-180 | └─ Linear OAuth flow | 2 | - |
| PRJ-181 | └─ Linear push | 1 | PRJ-180 |
| PRJ-182 | └─ Linear pull | 1 | PRJ-180 |

### Testing (5 tickets, 7 points)
| ID | Title | Points | Blocked By |
|----|-------|--------|------------|
| PRJ-163 | Unit tests (parent) | 3 | PRJ-161, PRJ-162 |
| PRJ-183 | └─ Setup Vitest | 1 | - |
| PRJ-184 | └─ Tests for get_state | 1 | PRJ-183 |
| PRJ-185 | └─ Tests for task ops | 2 | PRJ-183 |
| PRJ-171 | Integration tests | 3 | PRJ-163, PRJ-166 |

### Dashboard (5 tickets, 10 points)
| ID | Title | Points | Blocked By |
|----|-------|--------|------------|
| PRJ-172 | Dashboard MVP (parent) | 5 | PRJ-155, PRJ-167 |
| PRJ-176 | └─ Next.js + Auth | 1 | - |
| PRJ-177 | └─ ActivityFeed | 2 | PRJ-176 |
| PRJ-178 | └─ ActiveTask | 1 | PRJ-176 |
| PRJ-179 | └─ Deploy | 1 | PRJ-177, PRJ-178 |

### Infrastructure (3 tickets, 6 points)
| ID | Title | Points | Blocked By |
|----|-------|--------|------------|
| PRJ-167 | Events pipeline | 2 | PRJ-155 |
| PRJ-168 | Rate limiting | 2 | PRJ-157 |
| PRJ-169 | Error handling | 2 | PRJ-156 |

### Documentation & Launch (4 tickets, 6 points)
| ID | Title | Points | Blocked By |
|----|-------|--------|------------|
| PRJ-170 | Setup docs | 2 | PRJ-158 |
| PRJ-173 | Landing page | 2 | PRJ-172 |
| PRJ-174 | Monitoring | 1 | PRJ-158 |
| PRJ-175 | Launch | 1 | PRJ-171, PRJ-172, PRJ-173, PRJ-174 |

---

## Critical Path

The **longest path** determines the minimum project duration:

```
PRJ-154 → PRJ-155 → PRJ-159 → PRJ-160 → PRJ-161 → PRJ-163 → PRJ-171 → PRJ-175
   1pt      2pt       2pt       2pt       1pt       3pt       3pt       1pt
                                                              = 15 points
```

To ship faster, **parallelize aggressively**:
- While PRJ-155/156 are in progress, start reading MCP SDK docs
- PRJ-164 can run parallel to PRJ-159
- Dashboard (PRJ-172) can start once PRJ-155 + PRJ-167 are done
- Linear integration (PRJ-166) is not on critical path

---

## Weekly Sprint Plan

### Week 1 (8 points)
- [ ] PRJ-154 - Init TS project (1pt)
- [ ] PRJ-155 - Supabase setup (2pt)
- [ ] PRJ-156 - MCP Server base (2pt)
- [ ] PRJ-157 - Auth middleware (2pt)
- [ ] PRJ-158 - Deploy to Vercel (1pt)

### Week 2 (9 points)
- [ ] PRJ-159 - get_state (2pt)
- [ ] PRJ-160 - start_task (2pt)
- [ ] PRJ-161 - complete_task (1pt)
- [ ] PRJ-162 - pause/resume (1pt)
- [ ] PRJ-164 - log_decision (2pt)
- [ ] PRJ-169 - Error handling (2pt) *bonus if time*

### Week 3 (10 points)
- [ ] PRJ-165 - get_context (3pt)
- [ ] PRJ-167 - Events pipeline (2pt)
- [ ] PRJ-183 - Setup Vitest (1pt)
- [ ] PRJ-184 - Tests for state (1pt)
- [ ] PRJ-185 - Tests for tasks (2pt)
- [ ] PRJ-180 - Linear OAuth (2pt) *start*

### Week 4 (11 points)
- [ ] PRJ-181 - Linear push (1pt)
- [ ] PRJ-182 - Linear pull (1pt)
- [ ] PRJ-176 - Dashboard Next.js (1pt)
- [ ] PRJ-177 - ActivityFeed (2pt)
- [ ] PRJ-178 - ActiveTask (1pt)
- [ ] PRJ-168 - Rate limiting (2pt)
- [ ] PRJ-170 - Setup docs (2pt)
- [ ] PRJ-171 - Integration tests (3pt) *start*

### Week 5 (6 points)
- [ ] PRJ-179 - Deploy dashboard (1pt)
- [ ] PRJ-173 - Landing page (2pt)
- [ ] PRJ-174 - Monitoring (1pt)
- [ ] PRJ-175 - Launch! (1pt)
- [ ] Buffer for fixes

---

## Linear Project URL

https://linear.app/jlopezlira/project/mcp-server-pivot-b9ad475f0288
