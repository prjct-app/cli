---
name: architect-phases
description: Determine which architecture phases are needed
allowed-tools: [Read]
---

# Architecture Phase Selection

Analyze the idea and context to determine which phases are needed.

## Input
- Idea: {{idea}}
- Discovery results: {{discovery}}

## Available Phases

1. **discovery** - Problem definition, users, constraints
2. **user-flows** - User journeys and interactions
3. **domain-modeling** - Entities and relationships
4. **api-design** - API contracts and endpoints
5. **architecture** - System components and patterns
6. **data-design** - Database schema and storage
7. **tech-stack** - Technology choices
8. **roadmap** - Implementation plan

## Phase Selection Rules

**Always include**:
- discovery (foundation)
- roadmap (execution plan)

**Include if building**:
- user-flows: Has UI/UX
- domain-modeling: Has data entities
- api-design: Has backend API
- architecture: Complex system
- data-design: Needs database
- tech-stack: Greenfield project

**Skip if**:
- Simple script: Skip most phases
- Frontend only: Skip api-design, data-design
- CLI tool: Skip user-flows
- Existing stack: Skip tech-stack

## Output Format

Return array of needed phases:
```json
{
  "phases": ["discovery", "domain-modeling", "api-design", "roadmap"],
  "reasoning": "Simple CRUD app needs data model and API"
}
```

## Guidelines
- Don't over-architect
- Match complexity to project
- MVP first, expand later
