# AGENTS.md

AI assistant guidance for **prjct-cli** - developer momentum tool.

## Dynamic Agent Generation

Generate agents during `p. sync` based on analysis:

```javascript
await generator.generateDynamicAgent('agent-name', {
  role: 'Role Description',
  expertise: 'Technologies, versions, tools',
  responsibilities: 'What they handle'
})
```

### Guidelines
1. Read `analysis/repo-summary.md` first
2. Create specialists for each major technology
3. Name descriptively: `go-backend` not `be`
4. Include versions and frameworks found
5. Follow project-specific patterns

## Architecture

**Global**: `~/.prjct-cli/projects/{id}/`
```
storage/   # state.json, queue.json
context/   # now.md, next.md
agents/    # domain specialists
memory/    # events.jsonl
```

**Local**: `.prjct/prjct.config.json` (read-only)

## Commands

| Command | Action |
|---------|--------|
| `p. init` | Initialize |
| `p. sync` | Analyze + generate agents |
| `p. task X` | Start task |
| `p. done` | Complete subtask |
| `p. ship` | Ship feature |
| `p. next` | Show queue |

## Intent Detection

| Intent | Command |
|--------|---------|
| Start task | `p. task` |
| Finish | `p. done` |
| Ship | `p. ship` |
| What's next | `p. next` |

## Implementation

- Atomic operations
- Log to `memory/events.jsonl`
- Handle missing files gracefully
