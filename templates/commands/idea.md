---
allowed-tools: [Read, Write, Bash]
---

# p. idea "$ARGUMENTS"

```bash
prjct context idea
```

Detect priority from keywords:
- urgent/critical/asap → high
- later/maybe/nice-to-have → low
- default → medium

Detect tags: #ui, #perf, #bug, #api, #security, #docs

ADD to `{globalPath}/storage/ideas.json`:
```json
{"id":"{uuid}","text":"$ARGUMENTS","priority":"{priority}","tags":[...],"status":"pending","createdAt":"{now}"}
```

**Output**:
```
💡 $ARGUMENTS

Priority: {priority}
Tags: {tags}

Next:
- Start work → `p. task "$ARGUMENTS"`
- See ideas → `p. dash`
```
