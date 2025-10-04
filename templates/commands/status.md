---
allowed-tools: [Read]
description: 'KPI dashboard with ASCII graphics'
---

# /p:status

## Flow

1. Read: all core files + progress files
2. Calculate: metrics (sprint %, tasks complete, days since ship, etc.)
3. Render: `ASCIIGraphics.createDashboard(data)`

## Data Structure

```js
{
  sprintProgress: (complete / total) * 100,
  tasksComplete: count,
  tasksTotal: count,
  ideasCount: count,
  daysSinceShip: days,
  currentTask: string,
  taskTime: 'Xh Ym ago'
}
```

## Output (Catppuccin Mocha)

```
┌─ Project Status ────────────────┐
│ Sprint Progress  [████░] 80%    │
│ Tasks Complete   12/15          │
│ Ideas Backlog    8              │
│ Days Since Ship  3              │
├─ Current Focus ─────────────────┤
│ → {current_task}                │
│   Started: {time_ago}           │
└─────────────────────────────────┘
```

**Colors**: Mauve borders, Teal progress, Sapphire highlights, Green/Yellow/Red for status
