---
allowed-tools: [Write, GetTimestamp, GetDate]
description: 'Quick idea capture'
timestamp-rule: 'CRITICAL - ALWAYS use GetTimestamp() tool for timestamps. NEVER generate timestamps manually. LLM does not know current date/time.'
---

# /p:idea

## Usage

```
/p:idea <text>
```

## Flow

1. **Append to session**: `planning/sessions/{YYYY-MM}/{YYYY-MM-DD}.jsonl` (use GetTimestamp())
2. **Update index**: Append to `planning/ideas.md` (keep only last 30 days, use GetDate())
3. If actionable → add to `core/next.md`
4. **Archive old**: If ideas.md > 30 days, move to `planning/archive/ideas-{YYYY-MM}.md`

## Session Log Format

**Use GetTimestamp() tool for real system time:**

```jsonl
{"ts":"{GetTimestamp()}","type":"idea_add","idea":"{text}","actionable":{true/false},"priority":"{high/med/low}"}
```

## Response

```
💡 {idea}
{✅ Added to queue | 📝 Saved to backlog}

/p:now "{idea}" | /p:next
```
