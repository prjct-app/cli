---
allowed-tools: [Bash]
description: 'Design system architecture, APIs, and component interfaces'
---

# /p:design - System and Component Design

## Purpose

Design system architecture, APIs, component interfaces, database schemas, and technical specifications with visual diagrams and implementation guides.

## Usage

```
/p:design [target] [--type architecture|api|component|database|flow] [--format diagram|spec|code|all]
```

## Arguments

- `target` - System, component, or feature to design (e.g., "auth system", "payment API", "user dashboard")
- `--type` - Design type:
  - `architecture` - System architecture and high-level design
  - `api` - REST/GraphQL API endpoints and contracts
  - `component` - UI component hierarchy and interfaces
  - `database` - Database schema and relationships
  - `flow` - User flows and state machines
- `--format` - Output format:
  - `diagram` - ASCII diagrams and visual representations
  - `spec` - Technical specifications
  - `code` - Implementation templates and interfaces
  - `all` - Complete design package (default)

## Execution

Execute the command silently and show only the final result:

```bash
prjct design [args]
```

The command handles all operations internally. Show only the final animated result.

## Implementation

1. **Architecture Design**:
   ```
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │   Frontend  │────▶│   Backend   │────▶│  Database   │
   │    React    │     │   Node.js   │     │  PostgreSQL │
   └─────────────┘     └─────────────┘     └─────────────┘
          │                   │                    │
          ▼                   ▼                    ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │    Redux    │     │   Express   │     │    Redis    │
   │    Store    │     │   Routes    │     │    Cache    │
   └─────────────┘     └─────────────┘     └─────────────┘
   ```

2. **API Design**:
   ```typescript
   // REST API Endpoints
   POST   /api/auth/register
   POST   /api/auth/login
   GET    /api/users/:id
   PUT    /api/users/:id
   DELETE /api/users/:id

   // Request/Response Contracts
   interface UserRegistration {
     email: string
     password: string
     name: string
   }

   interface AuthResponse {
     token: string
     user: User
     expiresIn: number
   }
   ```

3. **Component Design**:
   ```
   <App>
   ├── <Header>
   │   ├── <Logo />
   │   ├── <Navigation />
   │   └── <UserMenu />
   ├── <Main>
   │   ├── <Sidebar />
   │   └── <Content>
   │       ├── <Dashboard />
   │       └── <Routes />
   └── <Footer>
   ```

4. **Database Schema**:
   ```sql
   ┌─────────────┐     ┌─────────────┐
   │    users    │────▶│   profiles  │
   ├─────────────┤     ├─────────────┤
   │ id (PK)     │     │ id (PK)     │
   │ email       │     │ user_id(FK) │
   │ password    │     │ bio         │
   │ created_at  │     │ avatar_url  │
   └─────────────┘     └─────────────┘
   ```

5. **Response Format**:
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
   • Data Flow: [flow description]

   📦 Implementation Guide:
   1. Set up project structure
   2. Implement core models
   3. Build API endpoints
   4. Create UI components
   5. Add tests and documentation

   📁 Files Created:
   • .prjct/designs/[target]-architecture.md
   • .prjct/designs/[target]-api-spec.md
   • .prjct/designs/[target]-implementation.md

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✅ Design ready for implementation!

   💡 Next: prjct now "Implement [target]"
   ```

6. **Design Templates**:
   - Save all designs to `.prjct/designs/` directory
   - Create reusable templates for common patterns
   - Generate implementation checklists
   - Include best practices and considerations

7. **Integration**:
   - Link designs to tasks in `/p:now`
   - Track implementation progress
   - Update designs based on implementation feedback

## Examples

```bash
# Design complete authentication system
prjct design "authentication system" --type architecture

# Design REST API for user management
prjct design "user API" --type api --format spec

# Design React component hierarchy
prjct design "dashboard" --type component

# Design database schema for e-commerce
prjct design "product catalog" --type database

# Complete design package for payment system
prjct design "payment system" --format all
```

## Design Patterns Library

### Authentication Pattern
```
Frontend → Auth Service → Token Validation → Backend API
                ↓
          User Database
```

### Microservices Pattern
```
API Gateway → Service Discovery
     ↓              ↓
  Services:    [Service A]
               [Service B]
               [Service C]
     ↓              ↓
  Message Queue  Databases
```

### Event-Driven Pattern
```
Producer → Event Bus → Consumers
             ↓
         Event Store
```