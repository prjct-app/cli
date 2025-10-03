---
allowed-tools: [Bash, Read, Write]
description: "Smart git operations with context"
---

# /p:git

## Usage
```
/p:git commit       # Smart commit with metadata
/p:git push         # Push with verification
/p:git sync         # Pull, rebase, push
/p:git undo         # Undo last commit
```

## Flow: commit
1. Read: `core/now.md` → get task context
2. Git: `add .` → stage changes
3. Create: commit message with prjct metadata
4. Commit: with message
5. Log: `memory/context.jsonl`

## Flow: push
1. Git: `status` → verify clean
2. Git: `push` with branch tracking
3. Handle: errors (upstream, conflicts)

## Flow: sync
1. Git: `pull --rebase`
2. Resolve: conflicts if any
3. Git: `push`

## Commit Message Format
```
{type}: {description}

Agent: {agent}
Dev: @{github_dev}

Generated-by: prjct/cli
Co-Authored-By: @{github_dev}
```

## Response
```
✅ Git {operation}

{operation_details}

/p:ship | /p:status
```

