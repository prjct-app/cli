---
name: health-score
description: Calculate project health score
allowed-tools: [Read]
---

# Project Health Score

Evaluate the project's health based on activity metrics.

## Input
- Active task: {{hasActiveTask}}
- Queue size: {{queueSize}}
- Recent ships: {{recentShips}}
- Ideas count: {{ideasCount}}
- Days since last ship: {{daysSinceShip}}

## Health Factors

### Momentum (40%)
- Active task = good
- Regular shipping = good
- Long gaps = concerning

### Focus (30%)
- Queue < 10 = focused
- Queue 10-20 = busy
- Queue > 20 = overloaded

### Progress (20%)
- Ships this week > 0 = active
- Ships this month > 2 = productive
- No ships in 7+ days = stalled

### Planning (10%)
- Ideas captured = thinking ahead
- Too many ideas = unfocused

## Score Calculation

Evaluate each factor and combine:

| Score | Label | Meaning |
|-------|-------|---------|
| 80-100 | Excellent | High momentum, focused, shipping |
| 60-79 | Good | Active, some room to improve |
| 40-59 | Fair | Slowing down, needs attention |
| 0-39 | Low | Stalled, intervention needed |

## Output Format

Return JSON:
```json
{
  "score": <0-100>,
  "label": "Excellent|Good|Fair|Low",
  "momentum": "<assessment>",
  "suggestions": ["<action 1>", "<action 2>"]
}
```

## Guidelines

- Be encouraging but honest
- Suggest specific actions
- Focus on momentum, not perfection
