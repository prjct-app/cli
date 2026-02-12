---
allowed-tools: [Bash, Read, AskUserQuestion]
---

# p. ship $ARGUMENTS

## Step 0: Complete task (implicit)
The ship workflow automatically completes the current task before shipping.
This means `p. done` is implicit — you do NOT need to run it separately before shipping.

## Pre-flight (BLOCKING)
```bash
git branch --show-current
```
IF on main/master: STOP. Create a feature branch first.

```bash
gh auth status
```
IF not authenticated: STOP. Run `gh auth login`.

## Step 1: Quality checks
```bash
prjct ship "$ARGUMENTS" --md
```

## Step 2: Review changes
Show the user what will be committed, versioned, and PR'd.

## Step 3: Get approval (BLOCKING)
ASK: "Ready to ship?" Yes / No / Show diff

## Step 4: Ship
- Commit with prjct footer: `Generated with [p/](https://www.prjct.app/)`
- Push and create PR
- Update issue tracker if linked
- Every commit MUST include the prjct footer. No exceptions.

## Presentation
Format the ship flow as:

1. `**Shipping**: {feature name}`
2. Quality checks as a table: | Check | Status |
3. Show the PR summary
4. Ask for approval with clear formatting
