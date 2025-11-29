---
name: database-design
description: Design database schema
allowed-tools: [Read, Glob, Grep]
---

# Database Design

Design database schema for the given requirements.

## Input
- Target: {{target}}
- Requirements: {{requirements}}

## Analysis Steps

1. **Identify Entities**
   - What data needs to be stored?
   - What are the relationships?
   - What queries will be common?

2. **Review Existing Schema**
   - Read current models/migrations
   - Match naming conventions
   - Use consistent patterns

3. **Design Tables/Collections**
   - Fields and types
   - Indexes for queries
   - Constraints and defaults

4. **Plan Migrations**
   - Order of operations
   - Data transformations
   - Rollback strategy

## Output Format

```markdown
# Database Design: {target}

## Entities

### users
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Unique identifier |
| email | varchar(255) | UNIQUE, NOT NULL | User email |
| created_at | timestamp | NOT NULL, DEFAULT now() | Creation time |

### posts
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Unique identifier |
| user_id | uuid | FK(users.id) | Author reference |
| title | varchar(255) | NOT NULL | Post title |

## Relationships
- users 1:N posts (one user has many posts)

## Indexes
- `users_email_idx` on users(email)
- `posts_user_id_idx` on posts(user_id)

## Migrations
1. Create users table
2. Create posts table with FK
3. Add indexes

## Queries (common)
- Get user by email: `SELECT * FROM users WHERE email = ?`
- Get user posts: `SELECT * FROM posts WHERE user_id = ?`
```

## Guidelines
- Normalize appropriately
- Add indexes for common queries
- Document relationships clearly
