---
allowed-tools: [Bash]
description: 'Ship a feature and celebrate the win'
---

# /p:ship - Ship Feature

## Purpose

Mark a feature as shipped and celebrate the achievement. Tracks velocity and progress.

## Usage

```
/p:ship <feature description>
```

## Execution

Execute the command silently and show only the final result:

```bash
prjct ship "<feature description>"
```

The command handles all file operations internally. Show only the celebration message.

## Implementation

1. **Get current week**:

   ```javascript
   const week = getISOWeek(new Date())
   const year = new Date().getFullYear()
   ```

2. **Update progress/shipped.md**:
   - Find or create section for current week
   - Add feature with timestamp and context links

   ```markdown
   ## Week [WEEK], [YEAR]

   - ✅ **[feature]** _(timestamp)_
     - Context: [link to related analysis/decisions]
     - Impact: [auto-generate impact assessment]
   ```

3. **Update progress/metrics.md**:
   - Total shipped count
   - Weekly velocity
   - Streak tracking
   - Performance indicators

4. **Update core/context.md**:
   - Latest achievement
   - Progress summary
   - Next focus suggestions

5. **Log to memory/context.jsonl**:

   ```json
   {
     "action": "ship",
     "feature": "[description]",
     "timestamp": "[ISO]",
     "week": "[week_number]",
     "layer": "progress",
     "total_shipped": [count]
   }
   ```

6. **Celebration response**:

   ```
   🚀 SHIPPED: [feature]

   🎉 That's [count] features shipped this week!
   📈 Velocity: [X] features/day
   🔥 Keep the momentum going!

   Share your win! #buildinpublic #shipped
   ```

## Motivation Messages

- First ship: "🎉 First feature shipped! You're on fire!"
- 5+ this week: "🔥 5 features this week! Incredible pace!"
- 10+ total: "🏆 Double digits! You're crushing it!"
- Friday ship: "🎊 Shipping on Friday! Perfect week ending!"
