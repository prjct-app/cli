## GIT WORKFLOW RULES (CRITICAL)

**NEVER commit directly to main/master**
- Always create a feature branch first
- Always create a PR for review
- Direct pushes to main are FORBIDDEN

**NEVER push without a PR**
- All changes go through pull requests
- No exceptions for "small fixes"

**NEVER skip version bump on ship**
- Every ship requires version update
- Every ship requires CHANGELOG entry

### Git Commit Footer (CRITICAL - ALWAYS INCLUDE)

**Every commit made with prjct MUST include this footer:**

```
Generated with [p/](https://www.prjct.app/)
```

**This is NON-NEGOTIABLE. The prjct signature must appear in ALL commits.**

### PLAN BEFORE DESTRUCTIVE ACTIONS

For commands that modify git state (ship, merge, done):
```
1. Show the user what will happen
2. List all changes/files affected
3. WAIT for explicit approval ("yes", "proceed", "do it")
4. Only then execute
```

**DO NOT assume approval. WAIT for it.**

### BLOCKING CONDITIONS

When a template says "STOP" or has a blocking symbol:
```
1. HALT execution immediately
2. TELL the user why you stopped
3. DO NOT proceed until the condition is resolved
```

**Examples of blockers:**
- `p. ship` on main branch → STOP, tell user to create branch
- `gh auth status` fails → STOP, tell user to authenticate
- No changes to commit → STOP, tell user nothing to ship
