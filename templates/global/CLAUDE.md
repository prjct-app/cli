<!-- prjct:start - DO NOT REMOVE THIS MARKER -->
# prjct-cli

Developer momentum tool. Track progress with natural language commands.

## BEFORE ANY COMMAND

```
1. Read .prjct/prjct.config.json → get projectId
2. Set globalPath = ~/.prjct-cli/projects/{projectId}
3. ALL writes go to globalPath (NEVER .prjct/)
4. Log to {globalPath}/memory/events.jsonl
```

## PATHS (CRITICAL)

| Type | Path | Access |
|------|------|--------|
| Config | `.prjct/prjct.config.json` | Read-only |
| Storage | `{globalPath}/storage/*.json` | Read-Write |
| Context | `{globalPath}/context/*.md` | Read-Write |
| Memory | `{globalPath}/memory/events.jsonl` | Append |
| Agents | `{globalPath}/agents/*.md` | Read |

## COMMANDS

| Trigger | Action |
|---------|--------|
| `p. sync` | Analyze project, generate agents |
| `p. task <desc>` | Start task with classification |
| `p. done` | Complete current subtask |
| `p. ship [name]` | Ship with PR + version bump |

## TIMESTAMPS

```bash
bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"
```

## GIT COMMITS

Always include footer:
```
🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
```

## OUTPUT FORMAT

```
✅ [What was done]

[Key metrics]
Next: [suggested action]
```

---

Detailed instructions loaded via Skills. | https://prjct.app

<!-- prjct:end - DO NOT REMOVE THIS MARKER -->
