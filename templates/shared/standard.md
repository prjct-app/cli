# Standard Practices (Reference Only)

All prjct commands inherit these patterns. Do NOT repeat in individual templates.

## Context Variables

| Variable | Source | Example |
|----------|--------|---------|
| `{projectId}` | `.prjct/prjct.config.json` | `bc401c41-c8b9-...` |
| `{globalPath}` | `~/.prjct-cli/projects/{projectId}` | Full path |
| `{cwd}` | Current directory | Repo root |

## Architecture: Write-Through

```
Action → Storage (JSON) → Context (MD) → Sync Events
```

- **Source of Truth**: `{globalPath}/storage/*.json`
- **Claude Context**: `{globalPath}/context/*.md`
- **Sync Queue**: `{globalPath}/sync/pending.json`

## Timestamps & UUIDs

```bash
# Timestamp (NEVER hardcode)
node -e "console.log(new Date().toISOString())"

# UUID
node -e "console.log(require('crypto').randomUUID())"
```

## Path Resolution (CRITICAL)

**ALL writes**: `~/.prjct-cli/projects/{projectId}/`

- NEVER write to `.prjct/` (read-only config)
- NEVER write to `./` for prjct data

## Error Handling

| Error | Response |
|-------|----------|
| No config | "No prjct project. Run p. init" → STOP |
| Not git repo | WARN, continue without git |
| File not found | Skip, continue |

## Git Commit Footer (REQUIRED)

```
🤖 Generated with [p/](https://www.prjct.app/)
```

## Parallel Operations

**ALWAYS batch** when operations are independent:
- Multiple READs → single parallel batch
- Multiple WRITEs → single parallel batch
- Git commands → chain with `&&`

## Output Format

```
✅ [Action completed]

[Key metrics]
Next: [suggested action]
```

Keep output under 4 lines unless errors occur.
