---
name: p:design
description: Design system architecture, APIs, and component interfaces
---

# /p:design - System Architecture and Design

Create technical designs with visual diagrams and implementation guides for system architecture, APIs, components, databases, and user flows.

## Usage

```
/p:design [target] [--type architecture|api|component|database|flow] [--format diagram|spec|code|all]
```

## Global Architecture

This command operates on global data stored in `~/.prjct-cli/projects/{project-id}/`.

### Steps

1. Parse design target and type (architecture, api, component, database, flow)
2. Generate appropriate ASCII diagrams and visual representations
3. Create technical specifications with technology stack and patterns
4. Generate implementation templates and interfaces
5. Save designs to `~/.prjct-cli/projects/{id}/designs/` directory
6. Display formatted design with overview, specs, and implementation guide
7. Link designs to tasks and track implementation progress

## Response Format

```
🎨 ✨ Design Complete! ✨ 🎨

📐 Design: [Target Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏗️ Architecture Overview:
[ASCII diagram or description]

📋 Technical Specifications:
• Technology Stack: [stack details]
• Design Patterns: [patterns used]
• Key Components: [component list]

📦 Implementation Guide:
1. Set up project structure
2. Implement core models
3. Build API endpoints
4. Create UI components

📁 Files Created:
• ~/.prjct-cli/projects/{id}/designs/[target]-architecture.md

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Design ready for implementation!

💡 Next: /p:now "Implement [target]"
```

## Design Types

### Architecture
- System architecture diagrams
- Component relationships
- Data flow and communication patterns
- Scalability considerations

### API
- Endpoint specifications
- Request/response schemas
- Authentication and authorization
- Rate limiting and caching

### Component
- Component interfaces
- Props and state management
- Lifecycle and hooks
- Styling and theming

### Database
- Schema design
- Entity relationships
- Indexing strategy
- Migration plans

### Flow
- User journey diagrams
- State machine flows
- Process workflows
- Integration flows

## Examples

Design system architecture:
```
/p:design authentication --type architecture
```

Design API endpoints:
```
/p:design user-management --type api --format spec
```

Design database schema:
```
/p:design products --type database --format diagram
```

Complete design with all formats:
```
/p:design payment-system --type architecture --format all
```
