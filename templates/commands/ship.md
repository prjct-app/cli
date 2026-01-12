---
allowed-tools: [Read, Write, Bash, Glob, Grep, AskUserQuestion]
description: 'Ship feature with automated PR workflow'
requires-thinking: true
---

# p. ship - Ship Feature

**See:** `@templates/shared/standard.md` for context variables and patterns.

## Pre-Ship Think Block (MANDATORY)

```
<think>
- [ ] All subtasks complete?
- [ ] Tests + lint pass?
- [ ] On feature branch (not main)?
- [ ] Breaking changes documented?
If ANY fails → STOP and fix first.
</think>
```

---

## Step 1: Validate (PARALLEL)

```
READ (parallel):
- .prjct/prjct.config.json → {projectId}
- {globalPath}/storage/state.json → {state}

BASH: git status --porcelain && git branch --show-current
```

| Check | Action |
|-------|--------|
| No config | STOP |
| On main/master | STOP |
| No changes | STOP |
| Active task | AskUserQuestion → Complete/Cancel |

---

## Step 2: Quality Checks (PARALLEL)

```bash
# Run lint and tests in parallel
{lintCommand} & {testCommand} & wait
```

Detect commands from package.json scripts or ecosystem defaults.

IF `--blocking` AND fails: STOP

---

## Step 3: Code Review (Skip if trivial)

IF `--skip-review` OR < 10 lines: Skip

Read all diffs in batch, analyze for:
- Security issues (hardcoded secrets, injection)
- Missing error handling
- Logic errors

Score issues 0-100. Report only >= 70%.

---

## Step 4: Version Bump (REQUIRED)

```bash
npm version {patch|minor|major} --no-git-tag-version
```

Detect bump type from commits:
- "BREAKING" → major
- "feat:" → minor
- else → patch

---

## Step 5: CHANGELOG (REQUIRED)

```bash
git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")..HEAD
```

Categorize: Added (feat), Fixed (fix), Changed (refactor)
Insert entry after `## [Unreleased]`

---

## Step 6: Create PR

```bash
git add . && \
git commit -m "$(cat <<'EOF'
feat: {feature}

🤖 Generated with [p/](https://www.prjct.app/)
EOF
)" && \
git push -u origin {branchName}
```

```bash
gh pr create --title "feat: {feature}" --body "{summary}"
```

---

## Step 7: Wait for CI (Exponential Backoff)

```
interval = 5s → 10s → 20s → 30s (max)
timeout = 10 minutes
```

```bash
gh pr checks {prNumber} --json name,state,conclusion
```

---

## Step 8: Update Storage (PARALLEL WRITES)

```
WRITE (parallel):
- {globalPath}/storage/state.json → update workflow phase
- {globalPath}/storage/shipped.json → prepend ship entry
- {globalPath}/context/shipped.md → regenerate

APPEND: {globalPath}/sync/pending.json
APPEND: {globalPath}/memory/events.jsonl
```

---

## Output

```
🚀 {feature} v{version}
{changeType} ({lines} lines) | CI {status}
📎 PR: {prUrl}

Next: p. verify
```
