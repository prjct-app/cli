# prjct Commands for OpenAI Codex / GitHub OpenAI Codex

When users type `/p:` commands, execute these actions using file operations.

## Command Implementation

### `/p:init`
Create project management structure:
```
.prjct/
├── now.md       # Current task
├── next.md      # Task queue
├── shipped.md   # Completed features
├── ideas.md     # Idea capture
└── memory.jsonl # Activity log
```

Copy templates from `~/.prjct-cli/templates/` and customize with project info.

### `/p:now [task]`
Current task management:
- **Read mode** (no args): Display content of `.prjct/now.md`
- **Write mode** (with task): Update `.prjct/now.md`:
  ```markdown
  # NOW: [task]
  Started: [timestamp]

  ## Task
  [Full task description]

  ## Notes
  [Empty for user notes]
  ```

### `/p:done`
Mark task complete:
1. Get current task from `.prjct/now.md`
2. Reset file to "No current task"
3. Append to `.prjct/memory.jsonl`:
   ```json
   {"action":"done","task":"[task]","timestamp":"[ISO_8601]"}
   ```
4. Check `.prjct/next.md` for queued tasks

### `/p:ship <feature>`
Ship and celebrate a feature:
1. Find or create week section in `.prjct/shipped.md`:
   ```markdown
   ## Week [N], [YYYY]
   ```
2. Add entry:
   ```markdown
   - ✅ **[feature]** _(YYYY-MM-DD HH:MM)_
   ```
3. Update statistics section
4. Return celebration message with total count

### `/p:next`
Show task queue from `.prjct/next.md`:
- Display as numbered list
- If empty, suggest using `/p:idea` to capture tasks

### `/p:idea <text>`
Quick capture to `.prjct/ideas.md`:
```markdown
- [text] _(date)_
```
If text matches `^(implement|add|fix|create|build|update)`, also add to `.prjct/next.md`

### `/p:recap`
Generate project summary:
```
📊 Project Recap
🎯 Current: [from now.md]
📦 Shipped: [count] features
📝 Queued: [count] tasks
💡 Ideas: [count]
```

### `/p:progress [period]`
Calculate metrics for period (day/week/month):
- Parse `.prjct/shipped.md` for date range
- Count features in period
- Calculate velocity
- Show trend and recent features

### `/p:stuck <issue>`
Provide help based on issue type:
- **Debugging**: Step-by-step isolation approach
- **Design**: Start simple, iterate approach
- **Performance**: Measure-first optimization approach
- **General**: Task breakdown strategy

### `/p:context`
Project awareness:
1. Detect project type from files
2. Show current task
3. Display recent activity from `.prjct/memory.jsonl`

## File Formats

### memory.jsonl
```json
{"action":"now","task":"implement auth","timestamp":"2024-12-28T10:00:00Z"}
{"action":"done","task":"implement auth","timestamp":"2024-12-28T14:30:00Z"}
{"action":"ship","feature":"authentication","timestamp":"2024-12-28T14:31:00Z"}
```

### Week Calculation
Use ISO 8601 week date:
```javascript
function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}
```

## Response Style

- Use emojis for visual feedback
- Confirm actions clearly
- Show relevant metrics
- Suggest next steps
- Keep messages concise and motivating