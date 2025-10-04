---
allowed-tools: [Read, Write, Bash]
description: 'Ship feature with complete automated workflow'
---

# /p:ship

## Usage

```
/p:ship              # Current task
/p:ship "<feature>"  # Named feature
```

## Complete Workflow (Automated)

1. ✅ **Lint checks** → Run project linters
2. ✅ **Run tests** → Execute test suite (does NOT block if fail)
3. ✅ **Update docs** → Update relevant documentation
4. ✅ **Update version** → Bump version (patch/minor based on changes)
5. ✅ **Update CHANGELOG** → Add entry with changes
6. ✅ **Git commit** → Create commit with metadata
7. ✅ **Git push** → Push to remote
8. ✅ **Recommend compact** → Suggest conversation compacting

## Workflow Steps Detail

### Step 1: Lint Checks

```bash
npm run lint || yarn lint || pnpm lint
# If fails: Show errors but continue
```

### Step 2: Run Tests

```bash
npm test || yarn test || pnpm test
# If fails: Show results but DO NOT block (no infinite loop)
# User decides if acceptable to ship
```

### Step 3: Update Docs

- Update README if needed
- Update API docs if endpoints changed
- Update component docs if UI changed

### Step 4: Update Version

```json
// package.json
"version": "X.Y.Z" → "X.Y.(Z+1)"  // patch for fixes
"version": "X.Y.Z" → "X.(Y+1).0"  // minor for features
```

### Step 5: Update CHANGELOG

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added / Changed / Fixed

- {feature_description}
- Agent: {agent}
- Time: {actual_time}
```

### Step 6-7: Git Commit + Push

Auto-commit with metadata and push

### Step 8: Recommend Compact

Suggest compacting conversation after ship

## Commit Message Format

```
feat: {feature_name}

Agent: {agent}
Dev: @{github_dev}
Complexity: {complexity}
Time: {actual_time}

🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
```

**IMPORTANT**: This footer format MUST be used in ALL commits made by prjct.

## Response

```
🚀 {feature} shipped!

Workflow completed:
  ✅ Lint checks: {pass/fail_continued}
  ✅ Tests: {pass/fail_continued}
  ✅ Docs: updated
  ✅ Version: {old} → {new}
  ✅ CHANGELOG: updated
  ✅ Git: committed + pushed

{agent_icon} {agent} • {actual_time}

💡 Recommendation: Compact conversation now
   (Keeps context clean for next feature)

/p:feature | /p:done
```

## Important Notes

- **Tests/Lint failures DO NOT block shipping**
- User sees results and decides
- Prevents infinite loop of "fix → test → fail → fix"
- ALWAYS updates version and CHANGELOG
- ALWAYS commits and pushes if workflow completes
