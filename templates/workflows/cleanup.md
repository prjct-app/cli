---
title: prjct cleanup
invocable_name: p:cleanup
description: Advanced code cleanup and optimization with backup capabilities
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` and `author` from config
3. Parse cleanup arguments (target, type, mode)
4. Create backup to `~/.prjct-cli/projects/{id}/backups/{timestamp}/` before aggressive cleanup
5. Execute cleanup by type:
   - **code**: Remove console.logs, commented code, dead code
   - **imports**: Remove unused imports, organize imports
   - **files**: Remove temp files, empty files, backups
   - **deps**: Analyze and remove unused npm dependencies
   - **memory**: Archive old memory entries (>30 days) to `~/.prjct-cli/projects/{id}/memory/archive/`
   - **all**: All cleanup types
6. Validate syntax after changes (JavaScript/TypeScript)
7. Log all changes to `~/.prjct-cli/projects/{id}/memory/cleanup-log.jsonl`
8. Log action with author to context.jsonl
9. Display cleanup results with metrics

# Response Format

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

# Safety Measures

- Create backup before aggressive cleanup
- Log all changes to cleanup-log.jsonl
- Validate syntax after modifications
- Skip files with uncommitted git changes
- Provide --dry-run option to preview

# Global Architecture Notes

- **Data Location**: `~/.prjct-cli/projects/{id}/`
- **Config Location**: `{project}/.prjct/prjct.config.json`
- **Backup Location**: `~/.prjct-cli/projects/{id}/backups/{timestamp}/`
- **Cleanup Log**: `~/.prjct-cli/projects/{id}/memory/cleanup-log.jsonl`
