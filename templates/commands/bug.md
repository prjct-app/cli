---
allowed-tools: [Bash, Task, AskUserQuestion]
---

# p. bug "$ARGUMENTS"

## Step 1: Validate Arguments

```
IF $ARGUMENTS is empty:
  ASK: "What bug do you want to report?"
  WAIT for response
  DO NOT proceed with empty description
```

## Step 2: Parse Severity from Keywords

Analyze `$ARGUMENTS` for severity indicators:
- `crash`, `down`, `broken`, `production`, `critical` → **critical**
- `error`, `fail`, `exception`, `cannot` → **high**
- `bug`, `incorrect`, `wrong`, `issue` → **medium** (default)
- `minor`, `typo`, `cosmetic`, `ui` → **low**

## Step 3: Explore Codebase

```
USE Task(Explore) → find affected files, recent commits related to the bug
```

## Step 4: Report Bug via CLI

```bash
prjct bug "$ARGUMENTS"
```

The CLI handles:
- Checking for active tasks
- Adding to queue with priority
- Storing in SQLite
- Event logging

## Step 5: Create Bug Branch (if fixing immediately)

```
AskUserQuestion:
  question: "Fix this bug now?"
  header: "Bug"
  options:
    - label: "Fix now (Recommended)"
      description: "Create branch and start fixing"
    - label: "Queue for later"
      description: "Bug is tracked, continue current work"
```

```
IF "Fix now":
  IF current branch == "main" OR "master":
    slug = sanitize($ARGUMENTS)
    git checkout -b bug/{slug}

IF "Queue for later":
  OUTPUT: "🐛 Queued: $ARGUMENTS [{severity}]"
  STOP
```

---

## Output

```
🐛 [{severity}] $ARGUMENTS

Affected: {files from exploration}
Branch: bug/{slug}

Next:
- Fix the bug → work on code
- When fixed → `p. done`
- Resume previous → `p. resume`
```
