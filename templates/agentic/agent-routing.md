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

## How to Invoke (EFFICIENT)

After deciding the best agent, **delegate via Task tool with REFERENCE, not content**:

```
Task(
  subagent_type: 'general-purpose',
  prompt: '
    ## Agent Assignment
    Read and apply: ~/.prjct-cli/projects/{projectId}/agents/{agent-name}.md

    ## Task
    {task description}

    ## Context
    - Project: {projectPath}
    - Files affected: {file list if known}

    ## Flow
    1. Read agent file FIRST
    2. Apply agent expertise and patterns
    3. Execute task following agent guidelines
    4. Return results
  '
)
```

### Why References, Not Content

| Approach | Prompt Size | Issue |
|----------|-------------|-------|
| ❌ Inject content | 3-5KB | Bloats context, increases hallucinations |
| ✅ Pass reference | ~200 bytes | Subagent reads what it needs |

**CRITICAL:** The subagent reads the agent file itself. You do NOT need to read and inject the content.

## Output (After Delegation)

After Task tool returns, summarize:

```
✅ Delegated to: {agent-name}
Result: {brief summary from subagent}
```

## Rules

- **Task-driven, not tech-driven** - Focus on what needs to be done
- **Context matters** - Same tech can mean different things in different projects
- **Be flexible** - One project's "backend" might be another's "full-stack"
- **Pass PATH, not CONTENT** - Let subagent read the agent file
- **Explain your reasoning** - Don't just pick, justify
