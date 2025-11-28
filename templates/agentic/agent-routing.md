---
allowed-tools: [Read]
description: 'Determine which agent should handle a task - Claude decides'
---

# Agent Routing Instructions

## Objective

Determine the best agent for a task by analyzing the ACTUAL task and project context.

## Step 1: Understand the Task

Read the task description and identify:

- What files will be modified?
- What type of work is involved?
- What knowledge is required?

## Step 2: Read Project Context

If project analysis exists, read it to understand:

- What technologies are actually used
- How the project is structured
- What patterns are established

## Step 3: Match Task to Agent

Based on your analysis, determine which agent is best suited:

**DO NOT assume:**
- "React" = frontend agent
- "Express" = backend agent
- "Database" = database agent

**DO analyze:**
- What the task actually requires
- What files will be touched
- What expertise is needed

## Available Agent Types

Consider these agent specializations:

- **Coordinator**: High-level planning, task breakdown
- **Frontend/UX**: UI components, user experience, styling
- **Backend**: API endpoints, server logic, business rules
- **Database**: Schema design, queries, migrations
- **DevOps/QA**: Testing, CI/CD, deployment, infrastructure
- **Full-stack**: Cross-cutting concerns, multiple layers

## Decision Process

1. Read task description
2. Identify primary area of work
3. Consider secondary areas
4. Choose agent with best expertise match

## Output

Return the recommended agent with reasoning:

```json
{
  "agent": "recommended-agent-type",
  "reasoning": "why this agent is best for the task",
  "confidence": "high|medium|low",
  "alternatives": ["other agents that could help"]
}
```

## Rules

- **Task-driven, not tech-driven** - Focus on what needs to be done
- **Context matters** - Same tech can mean different things in different projects
- **Be flexible** - One project's "backend" might be another's "full-stack"
- **Explain your reasoning** - Don't just pick, justify
