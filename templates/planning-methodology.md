# Software Planning Methodology for prjct

This methodology guides the AI through developing ideas into complete technical specifications.

## Phase 1: Discovery & Problem Definition

### Questions to Ask
- What specific problem does this solve?
- Who is the target user?
- What's the budget and timeline?
- What happens if this problem isn't solved?

### Output
- Problem statement
- User personas
- Business constraints
- Success metrics

## Phase 2: User Flows & Journeys

### Process
1. Map primary user journey
2. Identify entry points
3. Define success states
4. Document error states
5. Note edge cases

### Jobs-to-be-Done
When [situation], I want to [motivation], so I can [expected outcome]

## Phase 3: Domain Modeling

### Entity Definition
For each entity, define:
- Description
- Attributes (name, type, constraints)
- Relationships
- Business rules
- Lifecycle states

### Bounded Contexts
Group entities into logical boundaries with:
- Owned entities
- External dependencies
- Events published/consumed

## Phase 4: API Contract Design

### Style Selection
| Style    | Best For |
|----------|----------|
| REST     | Simple CRUD, broad compatibility |
| GraphQL  | Complex data requirements |
| tRPC     | Full-stack TypeScript |
| gRPC     | Microservices |

### Endpoint Specification
- Method/Type
- Path/Name
- Authentication
- Input/Output schemas
- Error responses

## Phase 5: System Architecture

### Pattern Selection
| Pattern | Best For |
|---------|----------|
| Modular Monolith | Small team, fast iteration |
| Serverless-First | Variable load, event-driven |
| Microservices | Large team, complex domain |

### C4 Model
1. Context - System and external actors
2. Container - Major components
3. Component - Internal structure

## Phase 6: Data Architecture

### Database Selection
| Type | Options | Best For |
|------|---------|----------|
| Relational | PostgreSQL | ACID, structured data |
| Document | MongoDB | Flexible schema |
| Key-Value | Redis | Caching, sessions |

### Schema Design
- Tables and columns
- Indexes
- Constraints
- Relationships

## Phase 7: Tech Stack Decision

### Frontend Stack
- Framework (Next.js, Remix, SvelteKit)
- Styling (Tailwind, CSS Modules)
- State management (Zustand, Jotai)
- Data fetching (TanStack Query, SWR)

### Backend Stack
- Runtime (Node.js, Bun)
- Framework (Next.js API, Hono)
- ORM (Drizzle, Prisma)
- Validation (Zod, Valibot)

### Infrastructure
- Hosting (Vercel, Railway, Fly.io)
- Database (Neon, PlanetScale)
- Cache (Upstash, Redis)
- Monitoring (Sentry, Axiom)

## Phase 8: Implementation Roadmap

### MVP Scope Definition
- Must-have features (P0)
- Should-have features (P1)
- Nice-to-have features (P2)
- Future considerations (P3)

### Development Phases
1. Foundation - Setup, core infrastructure
2. Core Features - Primary functionality
3. Polish & Launch - Optimization, deployment

### Risk Assessment
- Technical risks and mitigation
- Business risks and mitigation
- Dependencies and assumptions

## Output Structure

When complete, generate:

1. **Executive Summary** - Problem, solution, key decisions
2. **Architecture Documents** - All phases detailed
3. **Implementation Plan** - Prioritized tasks with estimates
4. **Decision Log** - Key choices and reasoning

## Interactive Development Process

1. **Classification**: Determine if idea needs full architecture
2. **Discovery**: Ask clarifying questions
3. **Generation**: Create architecture phase by phase
4. **Validation**: Review with user at key points
5. **Refinement**: Iterate based on feedback
6. **Output**: Save complete specification

## Success Criteria

A complete architecture includes:
- Clear problem definition
- User flows mapped
- Domain model defined
- API contracts specified
- Tech stack chosen
- Database schema designed
- Implementation roadmap created
- Risk assessment completed

## Templates

### Entity Template
```
Entity: [Name]
├── Description: [What it represents]
├── Attributes:
│   ├── id: uuid (primary key)
│   └── [field]: [type] ([constraints])
├── Relationships: [connections]
├── Rules: [invariants]
└── States: [lifecycle]
```

### API Endpoint Template
```
Operation: [Name]
├── Method: [GET/POST/PUT/DELETE]
├── Path: [/api/resource]
├── Auth: [Required/Optional]
├── Input: {schema}
├── Output: {schema}
└── Errors: [codes and descriptions]
```

### Phase Template
```
Phase: [Name]
├── Duration: [timeframe]
├── Tasks:
│   ├── [Task 1]
│   └── [Task 2]
├── Deliverable: [outcome]
└── Dependencies: [prerequisites]
```