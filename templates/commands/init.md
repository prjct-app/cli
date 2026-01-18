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

Optional: Ask about JIRA/Linear integration

**Output**:
```
✅ Initialized prjct

Project ID: {uuid}
Data: ~/.prjct-cli/projects/{uuid}/

Next:
- Analyze project → `p. sync`
- Start first task → `p. task "description"`
- See help → `p. help`
```
