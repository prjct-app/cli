---
title: prjct git
invocable_name: p:git
description: Smart git operations with prjct context using global prjct architecture
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` and `author` from config
3. Parse git subcommand and arguments
4. Read current task from `~/.prjct-cli/projects/{projectId}/core/now.md`
5. Read recent activity from `~/.prjct-cli/projects/{projectId}/memory/context.jsonl`
6. Execute git operation with context-aware behavior
7. Log git action to memory
8. Display result with workflow suggestions

# Supported Operations

## /p:git commit [message]
Smart commit with context-aware message generation

**Without message**:
- Analyze staged changes
- Read current task for context
- Generate meaningful commit message
- Preview and confirm

**With message**:
- Use provided message
- Add task context footer
- Execute commit

## /p:git status
Show git status with prjct context

**Output**:
- Standard git status
- Current prjct task
- Suggest next actions

## /p:git push
Push changes with progress tracking

**Process**:
- Execute git push
- Update shipped features if appropriate
- Log to memory
- Suggest celebration with /p:ship

## /p:git sync
Full sync workflow: pull, commit, push

**Process**:
- Pull latest changes
- Show conflicts if any
- Auto-commit with context if no conflicts
- Push to remote
- Update prjct state

# Response Formats

## commit
```
📝 Git Commit

Current Task: {task-from-now.md}

Staged Changes:
M  {file1}
M  {file2}
A  {file3}

Generated Message:
{context-aware-commit-message}

Related to: {task-description}

✅ Committed: {commit-hash}

Next Steps:
- Push changes: /p:git push
- Ship feature: /p:ship "{feature-name}"
- Move to next task: /p:done
```

## status
```
📊 Git Status

On branch: {branch}
Your branch is {ahead/behind/up-to-date}

Changes staged:
M  {file1}
M  {file2}

Changes not staged:
M  {file3}

Untracked files:
   {file4}

🎯 Current Task: {task-from-now.md}

💡 Suggestions:
- Ready to commit? /p:git commit
- Review changes: git diff
- Stage all: git add .
```

## push
```
🚀 Git Push

Pushing to origin/{branch}...

✅ Pushed successfully!
{commit-count} commits pushed

📈 Consider:
{if-significant-work}
- Ship this feature: /p:ship "{feature-name}"
- Update progress: /p:progress
{endif}

- Mark task done: /p:done
- Start next task: /p:now
```

## sync
```
🔄 Git Sync

1. ⬇️  Pulling latest changes...
   ✅ {changes} changes pulled

2. 📝 Staging local changes...
   ✅ {files} files staged

3. 💾 Committing...
   ✅ Committed: {hash}
   Message: {auto-generated-message}

4. ⬆️  Pushing to remote...
   ✅ Pushed successfully!

🎯 Current Task: {task}

All synced! Keep building! 🚀
```

# Context-Aware Commit Messages

Message generation considers:
- Current task from now.md
- Recent actions from memory
- Changed files and patterns
- Conventional commit types

Format:
```
{type}: {short-description}

{body-explaining-changes}

Task: {current-task-context}
Author: {author-from-config}
```

Types: feat, fix, docs, refactor, test, chore, style, perf

# Smart Suggestions

Based on changes:
- **Multiple features**: "Consider splitting into separate commits"
- **Breaking changes**: "Update version, add migration notes"
- **Tests added**: "Great! Test coverage improved"
- **Docs updated**: "Documentation up to date"

Based on prjct state:
- **Task complete**: "Use /p:done and /p:ship"
- **Long-running task**: "Make checkpoint commit?"
- **Many uncommitted changes**: "Commit frequently for safety"

# Global Architecture Notes

- **Current Task**: `~/.prjct-cli/projects/{id}/core/now.md` - Provides commit context
- **Memory Logging**: `~/.prjct-cli/projects/{id}/memory/context.jsonl` - Records git actions
- **Author Info**: From `{project}/.prjct/prjct.config.json`
- **Integration**: Seamless connection between code changes and task tracking
- **Use Case**: Context-aware version control, better commit messages, workflow integration
