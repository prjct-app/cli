---
allowed-tools: [Bash, AskUserQuestion]
---

# p. sync $ARGUMENTS

```bash
prjct sync $ARGUMENTS --md
```
If CLI output is JSON with `options`, present them to the user with AskUserQuestion and execute the chosen command.

Follow the instructions in the CLI output.

## Presentation
After running sync, present the output clearly:
- Use the tables and sections as-is from CLI markdown
- Add a brief interpretation of what changed and why
