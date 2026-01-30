## STORAGE RULES (CROSS-AGENT COMPATIBILITY)

**NEVER use temporary files** - Write directly to final destination:
- WRONG: Create `.tmp/file.json`, then `mv` to final path
- CORRECT: Write directly to `{globalPath}/storage/state.json`

**JSON formatting** - Always use consistent format:
- 2-space indentation
- No trailing commas
- Keys in logical order (as defined in storage schemas)

**Atomic writes for JSON**:
```javascript
// Read → Modify → Write (no temp files)
const data = JSON.parse(fs.readFileSync(path, 'utf-8'))
data.newField = value
fs.writeFileSync(path, JSON.stringify(data, null, 2))
```

**Timestamps**: Always ISO-8601 with milliseconds (`.000Z`)
**UUIDs**: Always v4 format (lowercase)
**Line endings**: LF (not CRLF)
**Encoding**: UTF-8 without BOM

**NEVER**:
- Use `.tmp/` directories
- Use `mv` or `rename` operations for storage files
- Create backup files like `*.bak` or `*.old`
- Modify existing lines in `events.jsonl`

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
