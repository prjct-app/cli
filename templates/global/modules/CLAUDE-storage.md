## STORAGE RULES (CROSS-AGENT COMPATIBILITY)

**All storage goes through SQLite** via `prjct` CLI commands. Never read or write JSON storage files directly.

The `prjct` CLI handles all reads and writes to `prjct.db` (SQLite) internally. Agents should use CLI commands for state management, not direct file I/O.

**Timestamps**: Always ISO-8601 with milliseconds (`.000Z`)
**UUIDs**: Always v4 format (lowercase)
**Line endings**: LF (not CRLF)
**Encoding**: UTF-8 without BOM

**NEVER**:
- Read or write JSON files in `storage/` directory
- Use `.tmp/` directories
- Use `mv` or `rename` operations for storage files
- Create backup files like `*.bak` or `*.old`

**Full specification**: See `{npm root -g}/prjct-cli/templates/global/STORAGE-SPEC.md`

---

## Preserve Markers (User Customizations)

User customizations in context files and agents survive regeneration using preserve markers:

```markdown
<!-- prjct:preserve -->
# My Custom Rules
- Always use tabs
- Prefer functional patterns
<!-- /prjct:preserve -->
```

**How it works:**
- Content between markers is extracted before regeneration
- After regeneration, preserved content is appended under "Your Customizations"
- Named sections: `<!-- prjct:preserve:my-rules -->` for identification
