---
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep, Task, AskUserQuestion]
---

# p. task $ARGUMENTS

## Step 1: Validate
If $ARGUMENTS is empty, ASK the user what task to start.

## Step 2: Get task context
```bash
prjct task "$ARGUMENTS" --md
```
If CLI output is JSON with `options`, present them to the user with AskUserQuestion and execute the chosen command.

## Step 3: Understand before acting (USE YOUR INTELLIGENCE)
- Read the relevant files from the CLI output
- If the task is ambiguous, ASK the user to clarify
- Explore beyond suggested files if needed (use Task with subagent_type=Explore)

## Step 4: Plan the approach
- For non-trivial changes, propose 2-3 approaches
- Consider existing patterns in the codebase
- If CLI output mentions domain agents, read them for project patterns

## Step 5: Execute
- Create feature branch if on main: `git checkout -b {type}/{slug}`
- Work through subtasks in order
- When done with a subtask: `prjct done --md`
- Every git commit MUST include footer: `Generated with [p/](https://www.prjct.app/)`

## Presentation
When showing task context to the user, format your response as:

1. Start with a brief status line: `**Task started**: {description}`
2. Show the subtask table from CLI output
3. List 2-3 key files you'll work on with `code formatting` for paths
4. End with your approach (concise, 2-3 bullets)

Keep responses scannable. Use tables for structured data. Use `code formatting` for file paths and commands.
