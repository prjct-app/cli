---
allowed-tools: [Read, Write, Bash, GetTimestamp, GetDate]
description: 'Value analysis + roadmap + task breakdown + auto-start'
timestamp-rule: 'GetTimestamp() and GetDate() for ALL timestamps'
---

# /p:feature

## Flow

1. **Value**: Impact/effort/timing → do_now/defer/blocked
2. **Roadmap**: Add to `planning/roadmap.md` (30 days max)
3. **Tasks**: Break down → `core/next.md`
4. **Session**: Log to `planning/sessions/{YYYY-MM}/{DD}.jsonl`
5. **Start**: Auto-start task 1 with agent assignment

**No params**: Show 6 categories (UI/Performance/Features/Quality/Bugs/Docs)

## Data

Session: `{"ts":"{GetTimestamp()}","type":"feature_add","name":"{f}","tasks":{n},"impact":"{h/m/l}","effort":"{Xh}"}`
Roadmap: `- [ ] {feature} ({n} tasks, {Xh}) - {GetDate()}`

## Response

`✅ {feature} | Impact: {impact} | {n} tasks | Starting #{1}`
