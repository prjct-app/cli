---
allowed-tools: [Read, Write]
description: 'Report and track bugs with auto-prioritization'
---

# /p:bug

## Usage

```
/p:bug "<description>"
```

## What It Does

1. **Severity detection**: Analyzes bug description for severity indicators
2. **Priority placement**: Adds to `core/next.md` based on severity
3. **Memory tracking**: Logs bug report to `memory/context.jsonl`
4. **Quick resolution**: Suggests immediate actions

## Severity Detection

Auto-detects severity from keywords:

- **Critical**: crash, down, broken, not working, production, urgent
- **High**: error, fail, issue, problem, major
- **Medium**: bug, incorrect, wrong, should
- **Low**: minor, small, cosmetic, typo

## Flow

1. Detect severity from description
2. Read `core/next.md`
3. Format bug entry: `🐛 [SEVERITY] description`
4. Insert at top if critical/high, bottom if medium/low
5. Write to `core/next.md`
6. Log to `memory/context.jsonl`

## Response Format

```
🐛 Bug reported: {severity}

{description}

Priority: {critical/high/medium/low}
Added to: core/next.md (position {top/bottom})

Quick actions:
• "start fixing" → /p:now "{description}"
• "show queue" → /p:next

/p:now | /p:next
```

## Example

```
User: p. bug "login button crashes on mobile"

Claude detects:
- Keywords: "crashes" → CRITICAL severity
- Action: Add to top of next.md
- Format: 🐛 [CRITICAL] login button crashes on mobile

Response:
🐛 Bug reported: CRITICAL

login button crashes on mobile

Priority: critical
Added to: core/next.md (top priority)

Quick actions:
• "start fixing" → /p:now "login button crashes on mobile"
• "show queue" → /p:next

/p:now | /p:next
```
