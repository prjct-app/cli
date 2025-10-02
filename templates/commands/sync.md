---
allowed-tools: [Read, Write, Bash, Glob, Grep, TodoWrite]
description: "Sync project state and update AI agents based on latest analysis"
---

# /p:sync - Sync Project State

## Purpose
Re-analyze the project and update all AI agents with current project state, stack changes, and new requirements.

## Global Architecture
This command uses the global prjct architecture:
- Data stored in: `~/.prjct-cli/projects/{id}/`
- Config stored in: `{project}/.prjct/prjct.config.json`
- Agents updated in: `~/.claude/agents/`

## Usage
```
/p:sync
```

## When to Run
- After major dependency changes
- When adding new frameworks or tools
- After significant architecture changes
- When project type changes (e.g., adding mobile support)
- Periodically to keep agents up-to-date

## Execution Flow

### 1. Re-run Project Analysis

Execute `/p:analyze` to get current project state:
```javascript
// This will:
// 1. Scan all files and directories
// 2. Detect current stack and frameworks
// 3. Check git status
// 4. Compare with previous analysis
// 5. Identify what changed
```

### 2. Detect Changes

Compare new analysis with previous:
```javascript
const previousAnalysis = await readFile('.prjct/analysis/repo-summary.md')
const currentAnalysis = await runAnalyze()

const changes = {
  newDependencies: [],
  removedDependencies: [],
  newFrameworks: [],
  stackChanges: [],
  structureChanges: []
}

// Detect what changed
if (currentAnalysis.frameworks !== previousAnalysis.frameworks) {
  changes.newFrameworks = difference(current, previous)
}
```

### 3. Update Existing Agents

Regenerate all current agents with new context:
```javascript
const agentGenerator = require('../core/agent-generator')

// Update all existing agents
const updated = await agentGenerator.updateExistingAgents(currentAnalysis)

console.log(`↻ Updated ${updated.length} agents with new context`)
```

### 4. Add New Agents

Generate any newly required agents:
```javascript
// Detect newly required agents
const existingAgents = await listAgentFiles()
const requiredAgents = detectRequiredAgents(currentAnalysis)
const newAgents = requiredAgents.filter(a => !existingAgents.includes(a))

if (newAgents.length > 0) {
  for (const agentType of newAgents) {
    await agentGenerator.generateAgent(agentType, currentAnalysis)
    console.log(`✅ Added ${agentType} agent`)
  }
}
```

### 5. Remove Obsolete Agents (Optional)

Ask user if agents should be removed:
```javascript
const obsoleteAgents = existingAgents.filter(a => !requiredAgents.includes(a))

if (obsoleteAgents.length > 0) {
  console.log(`\n⚠️  The following agents may no longer be needed:`)
  obsoleteAgents.forEach(a => console.log(`   - ${a}`))

  const shouldRemove = await confirmWithUser('\nRemove these agents? (y/n): ')

  if (shouldRemove) {
    await agentGenerator.cleanupObsoleteAgents(requiredAgents)
  }
}
```

### 6. Update Analysis File

Save new analysis:
```bash
# Backup previous analysis
cp .prjct/analysis/repo-summary.md .prjct/analysis/repo-summary.backup.md

# Save new analysis
# (already saved by /p:analyze)
```

### 7. Update Memory Log

Log sync action:
```jsonl
{"timestamp":"2025-10-02T14:30:00Z","action":"sync","author":"Name","changes":{"addedAgents":["mobile"],"updatedAgents":["fe","be"],"removedAgents":[],"stackChanges":["added react-native"]}}
```

## Output Examples

### No Changes
```
🔄 Syncing project state...

📊 Analysis Complete
   No significant changes detected

🤖 Agents Status
   ✓ All 7 agents are up-to-date

✅ Sync complete! Everything is current.
```

### With Changes
```
🔄 Syncing project state...

📊 Changes Detected
   ✅ New dependency: @tanstack/react-query
   ✅ New framework: Expo (React Native)
   ℹ️  Architecture: Still feature-based

🤖 Agent Updates
   ↻ FE agent - Added React Query patterns
   ↻ BE agent - Updated API integration context
   ✅ Mobile agent - ADDED (React Native detected)
   ✓ Other agents - No changes needed

⚠️  Obsolete Agents
   - devops (Docker removed from project)

   Remove obsolete agents? (y/n): _

✅ Sync complete!
   - 2 agents updated
   - 1 agent added
   - 1 agent removed
```

### Stack Migration
```
🔄 Syncing project state...

📊 Major Changes Detected
   ⚠️  Framework changed: Vue → React
   ⚠️  Build tool changed: Webpack → Vite
   ✅ New: TypeScript added

🤖 Full Agent Regeneration
   ↻ PM - Updated with React patterns
   ↻ UX - Updated component guidelines
   ↻ FE - COMPLETELY REGENERATED for React + TS
   ↻ BE - Updated API patterns
   ↻ QA - Updated test framework context
   ↻ Scribe - Updated documentation style

✅ Sync complete! All agents updated for new stack.

💡 Tip: Review agent descriptions to see new capabilities.
```

## Error Handling

- **No .prjct/**: Error - Project not initialized, run `/p:init` first
- **No analysis file**: Warning - Running first-time analysis
- **Agent generation fails**: Warn but continue with others
- **Permission issues**: Suggest checking `~/.claude/agents/` permissions

## Notes

- Sync is safe to run anytime
- Existing agents are updated, not deleted (unless confirmed)
- Git status is refreshed during sync
- Analysis diff helps track project evolution
- Agents get project-specific context from analysis

## Related Commands

- `/p:analyze` - Just analyze without updating agents
- `/p:init` - Initialize project (first-time setup)
- `/p:context` - View current project context

## Implementation Notes

The sync command should:
1. Be idempotent (safe to run multiple times)
2. Preserve manual agent customizations (warn if detected)
3. Create backups before major changes
4. Provide clear diff of what changed
5. Allow granular control (which agents to update)
