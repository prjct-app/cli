---
name: architecture-design
description: Design system architecture
allowed-tools: [Read, Glob, Grep]
---

# Architecture Design

Design the system architecture for the given requirements.

## Input
- Target: {{target}}
- Requirements: {{requirements}}
- Project context

## Analysis Steps

1. **Understand Requirements**
   - What problem are we solving?
   - What are the constraints?
   - What scale do we need?

2. **Review Existing Architecture**
   - Read current codebase structure
   - Identify existing patterns
   - Note integration points

3. **Design Components**
   - Core modules and responsibilities
   - Data flow between components
   - External dependencies

4. **Define Interfaces**
   - API contracts
   - Data structures
   - Event/message formats

## Output Format

Generate markdown document:

```markdown
# Architecture: {target}

## Overview
Brief description of the architecture.

## Components
- **Component A**: Responsibility
- **Component B**: Responsibility

## Data Flow
```
[Diagram using ASCII or mermaid]
```

## Interfaces
### API Endpoints
- `GET /resource` - Description
- `POST /resource` - Description

### Data Models
- `Model`: { field: type }

## Dependencies
- External service X
- Library Y

## Decisions
- Decision 1: Rationale
- Decision 2: Rationale
```

## Guidelines
- Match existing project patterns
- Keep it simple - avoid over-engineering
- Document decisions and trade-offs
