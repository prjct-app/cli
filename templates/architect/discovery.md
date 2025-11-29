---
name: architect-discovery
description: Discovery phase for architecture generation
allowed-tools: [Read, AskUserQuestion]
---

# Discovery Phase

Conduct discovery for the given idea to understand requirements and constraints.

## Input
- Idea: {{idea}}
- Context: {{context}}

## Discovery Steps

1. **Understand the Problem**
   - What problem does this solve?
   - Who experiences this problem?
   - How critical is it?

2. **Identify Target Users**
   - Who are the primary users?
   - What are their goals?
   - What's their technical level?

3. **Define Constraints**
   - Budget limitations?
   - Timeline requirements?
   - Team size?
   - Regulatory needs?

4. **Set Success Metrics**
   - How will we measure success?
   - What's the MVP threshold?
   - Key performance indicators?

## Output Format

Return structured discovery:
```json
{
  "problem": {
    "statement": "...",
    "painPoints": ["..."],
    "impact": "high|medium|low"
  },
  "users": {
    "primary": { "persona": "...", "goals": ["..."] },
    "secondary": [...]
  },
  "constraints": {
    "budget": "...",
    "timeline": "...",
    "teamSize": 1
  },
  "successMetrics": {
    "primary": "...",
    "mvpThreshold": "..."
  }
}
```

## Guidelines
- Ask clarifying questions if needed
- Be realistic about constraints
- Focus on MVP scope
