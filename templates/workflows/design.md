---
title: prjct design
invocable_name: p:design
description: Design system architecture, APIs, and component interfaces
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` and `author` from config
3. Parse design target and type (architecture, api, component, database, flow)
4. Generate appropriate ASCII diagrams and visual representations
5. Create technical specifications with technology stack and patterns
6. Generate implementation templates and interfaces
7. Save designs to `~/.prjct-cli/projects/{id}/designs/` directory
8. Display formatted design with overview, specs, and implementation guide
9. Link designs to tasks and track implementation progress
10. Log design creation to memory with author and timestamp

# Response Format

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

# Design Types

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

# Global Architecture Notes

- **Data Location**: `~/.prjct-cli/projects/{id}/designs/`
- **Config Location**: `{project}/.prjct/prjct.config.json`
- **Author Tracking**: All designs logged with author information
- **Design Versioning**: Designs linked to tasks for implementation tracking
