---
allowed-tools: [Bash, AskUserQuestion]
---

# p. pause $ARGUMENTS

If no reason provided, ask the user:

```
AskUserQuestion: "Why are you pausing?" with options: Blocked, Switching task, Break, Researching
```

```bash
prjct pause "$ARGUMENTS" --md
```

Follow the instructions in the CLI output.
