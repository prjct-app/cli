---
name: api-design
description: Design API endpoints and contracts
allowed-tools: [Read, Glob, Grep]
---

# API Design

Design RESTful API endpoints for the given feature.

## Input
- Target: {{target}}
- Requirements: {{requirements}}

## Analysis Steps

1. **Identify Resources**
   - What entities are involved?
   - What operations are needed?
   - What relationships exist?

2. **Review Existing APIs**
   - Read existing route files
   - Match naming conventions
   - Use consistent patterns

3. **Design Endpoints**
   - RESTful resource naming
   - Appropriate HTTP methods
   - Request/response shapes

4. **Define Validation**
   - Input validation rules
   - Error responses
   - Edge cases

## Output Format

```markdown
# API Design: {target}

## Endpoints

### GET /api/{resource}
**Description**: List all resources

**Query Parameters**:
- `limit`: number (default: 20)
- `offset`: number (default: 0)

**Response** (200):
```json
{
  "data": [...],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

### POST /api/{resource}
**Description**: Create resource

**Request Body**:
```json
{
  "field": "value"
}
```

**Response** (201):
```json
{
  "id": "...",
  "field": "value"
}
```

**Errors**:
- 400: Invalid input
- 401: Unauthorized
- 409: Conflict

## Authentication
- Method: Bearer token / API key
- Required for: POST, PUT, DELETE

## Rate Limiting
- 100 requests/minute per user
```

## Guidelines
- Follow REST conventions
- Use consistent error format
- Document all parameters
