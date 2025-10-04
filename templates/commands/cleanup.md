---
allowed-tools: [Read, Edit, Bash]
description: 'Code cleanup and optimization'
---

# /p:cleanup

## Usage

```
/p:cleanup [--type code|imports|files|deps|all] [--dry-run]
```

## Flow

1. Parse: type + mode
2. Backup: create if needed
3. Execute: cleanup by type
4. Validate: syntax check
5. Log: `memory/cleanup-log.jsonl`

## Types

- **code**: Remove console.logs, commented code, dead code
- **imports**: Remove unused, organize imports
- **files**: Remove temp files, empty files
- **deps**: Analyze unused dependencies
- **all**: All cleanup types

## Response

```
🧹 Cleanup complete!

📊 Results:
• Console.logs: {N} removed
• Dead code: {N} blocks
• Unused imports: {N}
• Space freed: {X} MB

/p:test | /p:ship
```
