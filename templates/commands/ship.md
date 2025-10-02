---
allowed-tools: [Read, Write, Edit, TodoWrite]
description: "Ship a feature"
---

# /p:ship

## Usage
```
/p:ship <feature>
```

## Execution

1. Add to `~/.prjct-cli/projects/{id}/progress/shipped.md`:
   ```markdown
   ## Week [W], [YEAR]
   - ✅ [feature] ([timestamp])
   ```

2. **Trigger Scribe Agent** (Documentation):
   - Get git changes for the feature: `git diff --name-only`
   - Invoke Scribe agent to document the shipped feature
   - Show documentation draft to user
   - **Request confirmation** before saving
   - Save to `analysis/feature-docs/[feature-id].md` if confirmed

3. Update `progress/metrics.md` (count, velocity, streak)
4. Update `core/context.md`
5. Log to `memory/context.jsonl`:
   ```json
   {"action":"ship","feature":"[desc]","timestamp":"[ISO]","week":"[w]","layer":"progress","total":[n],"documented":true}
   ```

6. Response:
   ```
   🚀 [feature name] shipped!

   📈 This week: [count] | Total: [total]
   Velocity: [X] features/day

   Keep the momentum!
   • "start next task" → Keep building
   • "see my progress" → View stats
   • "plan ahead" → Strategic thinking

   Or: /p:now | /p:recap | /p:roadmap
   ```

## Scribe Agent Workflow

When a feature is shipped, the Scribe agent is automatically invoked to document changes:

### Step 1: Detect Changes
```javascript
const gitIntegration = require('../core/git-integration')

// Get files changed for this feature
const changes = await gitIntegration.getChangesSince(featureStartTime)
```

### Step 2: Generate Documentation
Invoke Scribe agent with prompt:
```
Document the following shipped feature:

Feature: "[feature description]"
Shipped: [timestamp]
Files changed:
${changes.files.join('\n')}

Generate release documentation including:
1. Feature overview and user impact
2. Technical implementation summary
3. Key files and components affected
4. Breaking changes or migration notes (if any)
5. Usage examples

Keep it concise and user-focused (< 300 words).
```

### Step 3: Show Draft & Request Confirmation
```
📝 Scribe Agent Feature Documentation

## Feature: [feature description]

**Shipped**: [date]
**Impact**: [user-facing impact]

**Overview**:
[AI-generated feature summary]

**Technical Details**:
- [Implementation highlights]
- [Key components]

**Usage**:
[Examples if applicable]

**Breaking Changes**: [None / List]

─────────────────────────────────────

Save this documentation? (y/n): _
```

### Step 4: Save if Confirmed
```javascript
if (userConfirms) {
  const docPath = `~/.prjct-cli/projects/{id}/analysis/feature-docs/${featureId}.md`
  await saveDocumentation(docPath, documentation)
  console.log('✅ Feature documentation saved!')
} else {
  console.log('ℹ️  Documentation discarded')
}
```

## Example with Scribe

```
/p:ship "authentication system"

🚀 authentication system shipped!

📝 Scribe Agent is documenting your feature...

─────────────────────────────────────────────

## Feature: authentication system

**Shipped**: 2025-10-02
**Impact**: Users can now securely log in and manage sessions

**Overview**:
Implemented JWT-based authentication with login, registration, and password reset. Added middleware for protected routes and session management with automatic token refresh.

**Technical Details**:
- JWT authentication with bcrypt password hashing
- Login/register/reset endpoints in auth.controller.ts
- JWT middleware for route protection
- Redis-based session management with 7-day expiry
- Email verification workflow

**Files Modified**:
- src/features/auth/auth.service.ts (new)
- src/features/auth/auth.controller.ts (new)
- src/middleware/jwt.middleware.ts (new)
- src/config/redis.config.ts (modified)

**Breaking Changes**: None

**Usage**:
```javascript
// Protected route example
app.get('/api/profile', jwtMiddleware, profileController.get)
```

─────────────────────────────────────────────

Save this documentation? (y/n): y

✅ Feature documentation saved to analysis/feature-docs/!

📈 This week: 3 | Total: 15
Velocity: 2.1 features/day

Keep the momentum!
• "start next task" → Keep building
• "see my progress" → View stats

Or: /p:now | /p:recap
```

## Notes

- Scribe agent uses git history to understand feature scope
- Documentation is saved per-feature for release notes
- User confirmation prevents unwanted documentation
- Can skip documentation by saying "no"
- Feature docs help with changelog generation and onboarding