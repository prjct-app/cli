---
allowed-tools: [Bash, Read, AskUserQuestion]
---

# p. sessions

## Step 1: Show recent sessions
```bash
prjct sessions --md
```

## Step 2: Offer to resume
If sessions exist, ask the user which one to resume. Then switch to that project directory and run `prjct resume --md`.
