---
allowed-tools: [Glob, Read]
---

# Context Filtering

Determine relevant files for a task.

## Process

1. **Get real extensions**: Only include what EXISTS in project
2. **Identify directories**: Based on task, not assumptions
3. **Filter by task**: What files will be modified?
4. **Exclude non-relevant**: node_modules, .git, dist, build

## Output

```json
{
  "include": {
    "extensions": [".ts", ".tsx"],
    "directories": ["src/", "lib/"]
  },
  "exclude": {
    "directories": ["node_modules/", ".git/", "dist/"]
  },
  "reasoning": "why these patterns"
}
```

## Rules

- Use REAL extensions (not assumed)
- Task-specific filtering
- Efficient - focus on what matters
