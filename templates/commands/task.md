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
If CLI output is JSON with `options`, present the options to the user and execute the chosen command.

## Step 3: Understand before acting (USE YOUR INTELLIGENCE)
- Context7 is mandatory: for framework/library APIs, consult Context7 docs before implementation/refactor
- Read the relevant files from the CLI output
- If the task is ambiguous, ASK the user to clarify
- Explore beyond suggested files if needed

## Step 4: Pattern commitment (MANDATORY — do not skip)

Before writing ANY code, complete this checklist:

1. Read **Locked Decisions (NON-NEGOTIABLE)** from the Context Contract output. These are hard constraints — do not deviate.
2. Read **Pattern Briefing** — each pattern lists a VIOLATION line showing what NOT to do.
3. Read **Task Patterns (MUST follow)** — for each one, state HOW you will apply it to this specific task.

Output a commitment table:

| Pattern | Implementation plan for this task |
|---------|----------------------------------|
| (name from Task Patterns) | (concrete: which files, which types, which components) |

If no patterns were provided in the CLI output (e.g., project not yet synced), skip this step.
If the user corrects a commitment, update the table before proceeding.

## Step 5: Plan the approach
- For non-trivial changes, propose 2-3 approaches
- Consider existing patterns in the codebase
- If CLI output mentions domain agents, read them for project patterns
- Summarize anti-patterns from the CLI output before editing any file

## Step 6: Execute
- Create feature branch if on main: `git checkout -b {type}/{slug}`
- Work through subtasks in order
- When done with a subtask: `prjct done --md`
- Every git commit MUST include footer: `Generated with [p/](https://www.prjct.app/)`
- If a change may violate a high-severity anti-pattern, ask for confirmation and propose a safer alternative first

## Step 7: Ship (MANDATORY)
When all work is complete, you MUST execute the ship workflow:
ASK: "Work complete. Ready to ship?" Ship now / Continue working / Pause
- If Ship now: execute `p. ship` workflow (load and follow `~/.claude/commands/p/ship.md`)
- If Continue working: stay in Step 6
- If Pause: execute `p. pause`

NEVER end a task without asking about shipping. This is non-negotiable.

## Presentation
When showing task context to the user, format your response as:

1. Start with a brief status line: `**Task started**: {description}`
2. Show the subtask table from CLI output
3. List 2-3 key files you'll work on with `code formatting` for paths
4. End with your approach (concise, 2-3 bullets)

Keep responses scannable. Use tables for structured data. Use `code formatting` for file paths and commands.
