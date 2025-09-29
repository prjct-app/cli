# prjct Commands for Claude Code

When you see commands starting with `/p:`, execute these actions using your file system tools.

## Command Reference

### `/p:init`
Initialize a new prjct structure in the current project:
1. Create `.prjct/` directory
2. Copy templates from `~/.prjct-cli/templates/`
3. Replace template variables:
   - `[WEEK_NUMBER]` with current week number
   - `[YEAR]` with current year
   - `[PROJECT_TYPE]` with detected project type (Next.js, React, Node.js, etc.)

### `/p:now [task]`
Manage current focus:
- **Without arguments**: Read `.prjct/now.md` and display current task
- **With arguments**: Update `.prjct/now.md` with:
  ```markdown
  # NOW: [task]
  Started: [ISO_TIMESTAMP]

  ## Task
  [task description]

  ## Notes
  ```

### `/p:done`
Complete current task:
1. Read current task from `.prjct/now.md`
2. Clear `.prjct/now.md` (set to "No current task")
3. Log completion to `.prjct/memory.jsonl`
4. Suggest next task from `.prjct/next.md` if available

### `/p:ship <feature>`
Ship a feature:
1. Add to `.prjct/shipped.md` under current week section
2. Format: `- ✅ **[feature]** _(timestamp)_`
3. Update statistics (total count, velocity)
4. Celebrate with emojis! 🚀 🎉

### `/p:next`
Display task queue:
- Read `.prjct/next.md`
- Show numbered list of pending tasks
- Suggest using `/p:now` to start next task

### `/p:idea <text>`
Capture an idea:
1. Append to `.prjct/ideas.md` with timestamp
2. If text starts with action verb (implement, add, fix, create), also add to `.prjct/next.md`

### `/p:recap`
Show project status:
- Current task from `.prjct/now.md`
- Shipped count from `.prjct/shipped.md`
- Queue length from `.prjct/next.md`
- Ideas count from `.prjct/ideas.md`
- Display motivational message based on progress

### `/p:progress [period]`
Show progress metrics (period: day/week/month, default: week):
- Parse `.prjct/shipped.md` for timeframe
- Calculate velocity (features per day)
- Show recent shipped features
- Display trend indicator (📈/➡️/📉)

### `/p:stuck <issue>`
Provide contextual help:
- For "error/bug": Suggest debugging steps
- For "design/architecture": Suggest design approach
- For "performance": Suggest optimization strategy
- Default: Break into smaller tasks

### `/p:context`
Show project context:
- Detect project type from files (package.json, go.mod, etc.)
- Show current task
- Display last 5 actions from `.prjct/memory.jsonl`

## Response Format

Always respond with:
- Clear emoji indicators (📍 for focus, ✅ for complete, 🚀 for ship)
- Confirmation of action taken
- Relevant metrics when applicable
- Next suggested action to maintain momentum

## Implementation Notes

- All files are in `.prjct/` directory within the current project
- Use ISO 8601 timestamps
- Week numbers use ISO week date system
- Always preserve existing data when updating files
- Log all actions to `.prjct/memory.jsonl` as JSONL entries