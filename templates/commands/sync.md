---
allowed-tools: [Bash, AskUserQuestion]
---

# p. sync $ARGUMENTS

## Step 1: Run CLI sync
```bash
prjct sync $ARGUMENTS --md
```
If CLI output is JSON with `options`, present the options to the user and execute the chosen command.

Follow ALL instructions in the CLI output (including LLM Analysis if present).

## Step 2: Present results
After all steps complete, present the output clearly:
- Use the tables and sections as-is from CLI markdown
- If LLM analysis was performed, summarize key findings:
  - Architecture style and top insights
  - Critical anti-patterns (high severity)
  - Top tech debt items
  - Key conventions discovered
- Add a brief interpretation of what changed and why
