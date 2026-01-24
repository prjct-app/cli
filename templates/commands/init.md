---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
---

# p. init

Check if already initialized (`.prjct/prjct.config.json` exists)

Generate UUID: `crypto.randomUUID()`

Create directories in `~/.prjct-cli/projects/{projectId}/`:
- storage/ (state.json, queue.json, ideas.json, shipped.json)
- context/
- sync/
- agents/
- memory/

Create `.prjct/prjct.config.json`:
```json
{"projectId": "{uuid}", "dataPath": "~/.prjct-cli/projects/{uuid}"}
```

Create `{globalPath}/project.json` with project name from package.json

## Cursor IDE Detection

If `.cursor/` directory exists in project:
1. Ask: "Cursor IDE detected. Configure prjct for Cursor?"
2. If yes:
   - Get npm root: `npm root -g`
   - Copy router: `{npmRoot}/prjct-cli/templates/cursor/router.mdc` → `.cursor/rules/prjct.mdc`
   - Copy commands: `{npmRoot}/prjct-cli/templates/cursor/p.md` → `.cursor/commands/p.md`
   - Add to `.gitignore`:
     ```
     # prjct Cursor routers (regenerated per-developer)
     .cursor/rules/prjct.mdc
     .cursor/commands/p.md
     ```

Optional: Ask about JIRA/Linear integration

**Output**:
```
✅ Initialized prjct

Project ID: {uuid}
Data: ~/.prjct-cli/projects/{uuid}/
Cursor: {configured/not detected}

Next:
- Analyze project → `p. sync`
- Start first task → `p. task "description"`
- See help → `p. help`
```
