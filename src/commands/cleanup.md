---
allowed-tools: [Bash]
description: 'Clean up dead code and temporary files from project'
---

# /p:cleanup - Project Cleanup

## Purpose

Remove temporary files, compress old logs, and clean up completed tasks to keep your project lean.

## Usage

```
/p:cleanup
```

## Execution

Execute the command silently and show only the final result:

```bash
prjct cleanup
```

## What it does

- Removes temporary files from `.prjct/temp/`
- Compresses old entries in memory.jsonl (> 30 days)
- Cleans completed tasks older than 30 days
- Removes empty files in `.prjct/`
- Reports total space freed

## Response

Show only the final cleanup summary, not the process.