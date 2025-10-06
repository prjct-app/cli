---
allowed-tools: [Read, Write, Bash, GetTimestamp, GetDate]
description: 'Ship feature with complete automated workflow'
timestamp-rule: 'CRITICAL - ALWAYS use GetTimestamp() and GetDate() tools for ALL timestamps and dates. NEVER generate dates manually. LLM does not know current date.'
---

# /p:ship

## Usage

```
/p:ship              # Current task
/p:ship "<feature>"  # Named feature
```

## Complete Workflow (Automated)

1. ✅ **Lint checks** → Run linters (non-blocking if fail)
2. ✅ **Run tests** → Execute test suite (non-blocking if fail)
3. ✅ **Update docs** → README, API docs, component docs if needed
4. ✅ **Update version** → Bump version (patch/minor based on changes)
5. ✅ **Update CHANGELOG** → Add entry with metadata
6. ✅ **Git commit** → With prjct footer format
7. ✅ **Git push** → Push to remote
8. ✅ **Log to session** → Append to `progress/sessions/{YYYY-MM}/{YYYY-MM-DD}.jsonl`
9. ✅ **Update index** → Prepend to `progress/shipped.md` (last 30 days only)
10. ✅ **Update roadmap** → Mark as complete in `planning/roadmap.md`
11. ✅ **Recommend compact** → Suggest conversation compacting

## Session Log Format

Append to `progress/sessions/{YYYY-MM}/{YYYY-MM-DD}.jsonl`:

**Use GetTimestamp() tool for real system time:**

```jsonl
{"ts":"{GetTimestamp()}","type":"feature_ship","name":"{feature}","tasks_done":{N},"duration":"{Xh}","agent":"{agent}","version":"{X.Y.Z}"}
```

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

**CRITICAL**: This footer format MUST be used in ALL commits made by prjct.

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

- **Tests/Lint failures DO NOT block shipping** → User sees results and decides
- **ALWAYS** updates version and CHANGELOG
- **ALWAYS** commits and pushes if workflow completes
- Archive `shipped.md` entries > 30 days to `progress/archive/shipped-{YYYY-MM}.md`
