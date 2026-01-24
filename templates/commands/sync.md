---
allowed-tools: [Bash, Read, Write]
---

# p. sync

```bash
prjct sync
```

CLI handles: git analysis, context generation, agents, skills.

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
Cursor: {regenerated/ready/not detected}

Next:
- Start work → `p. task "description"`
- See queue → `p. next`
```
