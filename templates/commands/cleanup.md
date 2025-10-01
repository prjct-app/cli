---
name: p:cleanup
description: Advanced code cleanup and optimization with backup capabilities
---

# /p:cleanup - Advanced Code Cleanup and Optimization

Remove dead code, optimize imports, clean project structure, analyze unused dependencies, and clean up temporary files. Comprehensive cleanup with backup capabilities.

## Usage

```
/p:cleanup [target] [--type code|imports|files|deps|memory|all] [--safe|--aggressive] [--dry-run]
```

## Global Architecture

This command operates on global data stored in `~/.prjct-cli/projects/{project-id}/`.

### Steps

1. Read `.prjct/prjct.config.json` for project ID and author
2. Parse cleanup arguments (target, type, mode)
3. Create backup to `~/.prjct-cli/projects/{id}/backups/{timestamp}/` before aggressive cleanup
4. Execute cleanup by type:
   - **code**: Remove console.logs, commented code, dead code
   - **imports**: Remove unused imports, organize imports
   - **files**: Remove temp files, empty files, backups
   - **deps**: Analyze and remove unused npm dependencies
   - **memory**: Archive old memory entries (>30 days) to `~/.prjct-cli/projects/{id}/memory/archive/`
   - **all**: All cleanup types
5. Validate syntax after changes (JavaScript/TypeScript)
6. Log all changes to `~/.prjct-cli/projects/{id}/memory/cleanup-log.jsonl`
7. Log action with author to context.jsonl
8. Display cleanup results with metrics

## Response Format

```
🧹 ✨ Cleanup Complete! ✨ 🧹

📊 Cleanup Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗑️ Dead Code Removed:
• Console.logs: {count} statements
• Commented code: {count} blocks
• Unused functions: {count}

📦 Imports Optimized:
• Unused imports: {count} removed
• Files organized: {count}

📁 Files Cleaned:
• Temp files: {count} removed
• Empty files: {count} removed
• Space freed: {size} MB

📚 Dependencies:
• Unused packages: {count} removed
• Size reduced: {size} MB

📦 Archived:
• Memory entries: {count} (older than 30 days)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Your project is clean and optimized!

💡 Tip: Run with --dry-run first to preview changes
```

## Safety Measures

- Create backup before aggressive cleanup
- Log all changes to cleanup-log.jsonl
- Validate syntax after modifications
- Skip files with uncommitted git changes
- Provide --dry-run option to preview

## Examples

Basic cleanup:
```
/p:cleanup
```

Cleanup specific type:
```
/p:cleanup --type code
/p:cleanup --type imports
/p:cleanup --type deps
```

Preview changes:
```
/p:cleanup --dry-run
```

Aggressive cleanup with backup:
```
/p:cleanup --aggressive --type all
```
