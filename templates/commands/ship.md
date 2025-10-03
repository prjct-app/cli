---
allowed-tools: [Read, Write, Bash]
description: "Ship feature with Git commit/push"
---

# /p:ship

## Usage
```
/p:ship              # Current task
/p:ship <feature>    # Named feature
```

## Flow
1. Get: feature name (from arg or `core/now.md`)
2. Git: `add .` → check status
3. Create: commit message with metadata
4. Commit: with message
5. Prompt: "Push? (y/n)"
6. If yes: `git push`
7. Update: `progress/shipped.md`, clear `core/now.md`
8. Log: `memory/context.jsonl`

## Commit Message
```
feat: {feature_name}

Agent: {agent}
Dev: @{github_dev}
Complexity: {complexity}
Time: {actual_time}

Generated-by: prjct/cli
Co-Authored-By: @{github_dev}
```

## Response
```
🚀 {feature} shipped!

✅ Committed {+ pushed}
{agent_icon} {agent} • {actual_time}

/p:next | /p:status
```

