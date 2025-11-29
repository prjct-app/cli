---
name: bug-severity
description: Assess bug severity from description
allowed-tools: [Read]
---

# Bug Severity Assessment

Analyze the bug description to determine its severity and priority.

## Input
- Bug: {{description}}
- Context (if available)

## Severity Levels

### CRITICAL
- System crash or data loss
- Security vulnerability
- Blocks all users
- Production is down

### HIGH
- Major feature broken
- Significant user impact
- Workaround difficult
- Affects many users

### MEDIUM
- Feature partially broken
- Workaround exists
- Limited user impact
- Non-essential functionality

### LOW
- Minor inconvenience
- Cosmetic issue
- Edge case only
- Easy workaround

## Analysis Steps

1. **Assess Impact**
   - Who is affected?
   - How many users?
   - Is there data loss risk?

2. **Check Urgency**
   - Is production affected?
   - Is there a deadline?
   - Are users blocked?

3. **Evaluate Workaround**
   - Can users continue working?
   - How hard is the workaround?

## Output Format

Return JSON:
```json
{
  "severity": "critical|high|medium|low",
  "priority": 1-4,
  "reasoning": "<brief explanation>",
  "suggestedAction": "<what to do next>"
}
```

## Guidelines

- Err on the side of higher severity if unsure
- Security issues are always CRITICAL
- Data loss is always CRITICAL
- User-reported = add weight
