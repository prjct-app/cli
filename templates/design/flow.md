---
name: flow-design
description: Design user/data flow
allowed-tools: [Read, Glob, Grep]
---

# Flow Design

Design the user or data flow for the given feature.

## Input
- Target: {{target}}
- Requirements: {{requirements}}

## Analysis Steps

1. **Identify Actors**
   - Who initiates the flow?
   - What systems are involved?
   - What are the touchpoints?

2. **Map Steps**
   - Start to end journey
   - Decision points
   - Error scenarios

3. **Define States**
   - Initial state
   - Intermediate states
   - Final state(s)

4. **Plan Error Handling**
   - What can go wrong?
   - Recovery paths
   - User feedback

## Output Format

```markdown
# Flow: {target}

## Overview
Brief description of this flow.

## Actors
- **User**: Primary actor
- **System**: Backend services
- **External**: Third-party APIs

## Flow Diagram
```
[Start] → [Step 1] → [Decision?]
                         ↓ Yes
                    [Step 2] → [End]
                         ↓ No
                    [Error] → [Recovery]
```

## Steps

### 1. User Action
- User does X
- System validates Y
- **Success**: Continue to step 2
- **Error**: Show message, allow retry

### 2. Processing
- System processes data
- Calls external API
- Updates database

### 3. Completion
- Show success message
- Update UI state
- Log event

## Error Scenarios
| Error | Cause | Recovery |
|-------|-------|----------|
| Invalid input | Bad data | Show validation |
| API timeout | Network | Retry with backoff |
| Auth failed | Token expired | Redirect to login |

## States
- `idle`: Initial state
- `loading`: Processing
- `success`: Completed
- `error`: Failed
```

## Guidelines
- Cover happy path first
- Document all error cases
- Keep flows focused
