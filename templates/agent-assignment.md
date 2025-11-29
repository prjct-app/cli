---
name: agent-assignment
description: Assign the best agent for a task
allowed-tools: [Read]
---

# Agent Assignment

Select the best agent for the given task based on semantic understanding.

## Input

- **Task**: {{task}}
- **Available Agents**: {{agents}}
- **Project Context**: {{context}}

## Instructions

1. **Understand the Task**
   - What domain does this task belong to?
   - What skills are required?
   - What is the complexity level?

2. **Analyze Available Agents**
   - Read each agent's expertise and domain
   - Consider their skills and past success
   - Match capabilities to task requirements

3. **Select Best Agent**
   - Choose the agent with highest relevance
   - If multiple agents fit, prefer the specialist over generalist
   - If no good match, use 'generalist' or 'full-stack'

## Decision Criteria

- **Domain Match**: Does the agent's domain align with the task?
- **Skills Match**: Does the agent have the required skills?
- **Complexity Fit**: Is the agent appropriate for this complexity level?

## Output Format

Return JSON with your decision:

```json
{
  "agent": "agent-name",
  "confidence": 0.85,
  "reason": "Brief explanation of why this agent was selected",
  "domain": "detected domain of the task"
}
```

## Examples

**Task**: "Implement React login component with form validation"
**Decision**: `{ "agent": "frontend-specialist", "confidence": 0.95, "reason": "React component work requires frontend expertise", "domain": "frontend" }`

**Task**: "Fix database connection timeout issue"
**Decision**: `{ "agent": "backend-specialist", "confidence": 0.90, "reason": "Database issues require backend/infrastructure knowledge", "domain": "backend" }`

**Task**: "Write unit tests for user service"
**Decision**: `{ "agent": "qa-specialist", "confidence": 0.85, "reason": "Testing tasks benefit from QA expertise", "domain": "qa" }`

**Task**: "Update README documentation"
**Decision**: `{ "agent": "generalist", "confidence": 0.70, "reason": "Documentation is general task, no specialist needed", "domain": "docs" }`

## Guidelines

- Prefer specialists when task clearly fits their domain
- Use generalist only when no specialist matches
- Higher confidence = stronger match
- Always provide a reason for transparency
