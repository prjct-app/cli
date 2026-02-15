---
allowed-tools: [Bash, AskUserQuestion]
---

# p. pause $ARGUMENTS

If no reason provided, ask the user:

Ask the user: "Why are you pausing?" with options: Blocked, Switching task, Break, Researching

```bash
prjct pause "$ARGUMENTS" --md
```
If CLI output is JSON with `options`, present the options to the user and execute the chosen command.

Follow the instructions in the CLI output.
