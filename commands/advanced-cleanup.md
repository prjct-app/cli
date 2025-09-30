---
allowed-tools: [Bash]
description: 'Advanced cleanup - remove dead code, optimize imports, clean project structure'
---

# /p:cleanup-advanced - Advanced Code and Project Cleanup

## Purpose

Systematically clean up code, remove dead code, optimize imports, unused dependencies, and improve project structure.

## Usage

```
/p:cleanup-advanced [target] [--type code|imports|files|deps|all] [--safe|--aggressive]
```

## Arguments

- `target` - Files, directories, or entire project to clean (default: current directory)
- `--type` - Cleanup type:
  - `code` - Remove dead code, commented code, console.logs
  - `imports` - Remove unused imports, organize imports
  - `files` - Remove empty files, temp files, backup files
  - `deps` - Remove unused npm dependencies
  - `all` - All cleanup types (default)
- `--safe` - Conservative cleanup (default)
- `--aggressive` - More thorough cleanup with higher risk
- `--dry-run` - Preview changes without applying them

## Execution

Execute the command silently and show only the final result:

```bash
prjct cleanup-advanced [args]
```

The command handles all operations internally. Show only the final animated result.

## Implementation

1. **Analysis Phase**:
   - Scan project for cleanup opportunities
   - Identify dead code patterns
   - Find unused imports and dependencies
   - Detect redundant files

2. **Dead Code Detection**:
   ```javascript
   // Patterns to remove:
   - console.log/console.debug statements
   - Commented out code blocks
   - TODO/FIXME comments (with --aggressive)
   - Unused functions (with --aggressive)
   - Unreachable code
   ```

3. **Import Optimization**:
   ```javascript
   // For JavaScript/TypeScript:
   - Remove unused imports
   - Sort imports alphabetically
   - Group imports by type (external, internal)
   ```

4. **File Cleanup**:
   ```
   Remove:
   - *.tmp, *.temp, *.bak files
   - .DS_Store files
   - Empty directories
   - node_modules in nested directories
   - Build artifacts outside designated folders
   ```

5. **Dependency Cleanup**:
   ```bash
   # Analyze package.json
   # Find unused dependencies
   # Remove with npm uninstall
   ```

6. **Response Format**:
   ```
   🧹 ✨ Advanced Cleanup Complete! ✨ 🧹

   📊 Cleanup Results:
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   🗑️ Dead Code Removed:
   • Console.logs: 15 statements
   • Commented code: 8 blocks
   • Unused functions: 3

   📦 Imports Optimized:
   • Unused imports: 12 removed
   • Files organized: 24

   📁 Files Cleaned:
   • Temp files: 5 removed
   • Empty files: 3 removed
   • Space freed: 2.5 MB

   📚 Dependencies:
   • Unused packages: 4 removed
   • Size reduced: 15 MB

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✨ Your code is clean and optimized!

   💡 Tip: Run with --dry-run first to preview changes
   ```

7. **Safety Measures**:
   - Create .prjct/backup/ before aggressive cleanup
   - Log all changes to .prjct/cleanup-log.jsonl
   - Validate JavaScript/TypeScript syntax after changes
   - Skip files with uncommitted git changes

## Examples

```bash
# Safe cleanup of entire project
prjct cleanup-advanced

# Aggressive cleanup with preview
prjct cleanup-advanced --aggressive --dry-run

# Clean only imports in src folder
prjct cleanup-advanced src --type imports

# Remove unused dependencies
prjct cleanup-advanced --type deps
```