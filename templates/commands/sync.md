---
allowed-tools: [Bash, Read, Write]
---

# p. sync

```bash
prjct sync
```

CLI handles: git analysis, context generation, agents, skills.

## Linear Sync (when enabled)

```
READ: .prjct/prjct.config.json → get projectId
READ: {globalPath}/project.json → check integrations.linear.enabled

IF integrations.linear.enabled:
  # Sync Linear issues to local cache
  RUN: bun core/cli/linear.ts --project {projectId} sync

  # Result stored in {globalPath}/storage/issues.json
  # Contains all assigned issues from Linear

  OUTPUT: "Linear: {fetched} issues synced"
```

## Cursor Router Regeneration

If `.cursor/` exists but `.cursor/rules/prjct.mdc` is missing:
1. Get npm root: `npm root -g`
2. Create `.cursor/rules/` directory if needed
3. Copy router: `{npmRoot}/prjct-cli/templates/cursor/router.mdc` → `.cursor/rules/prjct.mdc`
4. Copy commands: `{npmRoot}/prjct-cli/templates/cursor/p.md` → `.cursor/commands/p.md`
5. Report: "Cursor routers regenerated"

**Output**:
```
✅ Synced: {projectName}

Ecosystem: {ecosystem}
Agents: {count} generated
Linear: {issueCount} issues synced (or "not enabled")
Cursor: {regenerated/ready/not detected}

Next:
- Start work → `p. task "description"`
- See queue → `p. next`
```
