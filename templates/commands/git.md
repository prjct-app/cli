---
allowed-tools: [Bash, AskUserQuestion]
---

# p. git $ARGUMENTS

Supports: `commit`, `push`, `sync`, `undo`.

## BLOCKING: Never commit/push to main/master.

```bash
prjct git $ARGUMENTS --md
```

Follow the instructions in the CLI output.

Every commit MUST include footer: `Generated with [p/](https://www.prjct.app/)`
