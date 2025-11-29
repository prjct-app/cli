---
name: complexity-analysis
description: Analyze task complexity semantically
allowed-tools: [Read]
---

# Task Complexity Analysis

Analyze the given task description and determine its complexity level.

## Input
- Task: {{task}}
- Project context (if available)

## Analysis Steps

1. **Understand the Task**
   - What is being asked?
   - What systems/files are affected?
   - Are there dependencies?

2. **Evaluate Scope**
   - Single file change → LOW
   - Multiple files, same module → MEDIUM
   - Cross-module or architectural → HIGH

3. **Assess Risk**
   - Read-only or additive → LOW risk
   - Modifying existing logic → MEDIUM risk
   - Refactoring or migration → HIGH risk

4. **Consider Dependencies**
   - No external deps → LOW
   - Some integration → MEDIUM
   - Multiple systems → HIGH

## Output Format

Return JSON:
```json
{
  "complexity": "low|medium|high",
  "type": "feature|bugfix|refactor|testing|docs|chore",
  "estimatedHours": <number>,
  "reasoning": "<brief explanation>"
}
```

## Guidelines

- Be realistic, not optimistic
- Consider testing time in estimates
- If unsure, lean toward higher complexity
- Don't use keyword matching - analyze semantically
