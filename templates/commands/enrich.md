---
allowed-tools: [Read, Write, Bash, Task, Glob, Grep, AskUserQuestion]
description: 'Enrich minimal task descriptions with AI-generated context'
---

# p. enrich - PM Expert Task Enrichment

Transform minimal product descriptions into complete technical tasks with user stories, acceptance criteria, and LLM-ready prompts.

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{input}`: User-provided title or issue ID

---

## Quick Flow

```
1. Validate project exists
2. Parse input (title or issue ID)
3. If issue ID: fetch from Linear/Jira
4. Run 5-phase enrichment
5. Generate output (PM view + Dev view)
6. Optionally push to issue tracker
7. Save locally
```

---

## Step 1: Validate Project

```
READ: .prjct/prjct.config.json
EXTRACT: projectId
SET: globalPath = ~/.prjct-cli/projects/{projectId}

IF file not found:
  OUTPUT: "No prjct project. Run `p. init` first."
  STOP
```

---

## Step 2: Parse Input

```
IF input matches pattern /^[A-Z]+-\d+$/ (e.g., ENG-123):
  SET: mode = "issue"
  SET: issueId = input
  FETCH issue from issue tracker
ELSE:
  SET: mode = "title"
  SET: originalTitle = input
```

---

## Step 3: Gather Project Context

```
READ: {globalPath}/project.json → techStack, patterns
READ: package.json → dependencies
BASH: git log --oneline -10 → recent commits
```

---

## Phase 1: Intelligent Classification

Analyze the input to determine:

```
OUTPUT:
Analyzing: {input}

Classification:
- Type: {bug|feature|improvement|task|chore}
- Priority: {critical|high|medium|low}
- Labels: [{suggested labels}]
- Complexity: {trivial|small|medium|large|epic}

Reasoning: {why this classification}
```

**Classification Rules:**
- Contains "fix", "broken", "error", "not working" → likely `bug`
- Contains "add", "create", "implement", "new" → likely `feature`
- Contains "improve", "enhance", "better", "faster" → likely `improvement`
- Contains "update", "change", "modify" → likely `task`
- Contains "deps", "config", "cleanup" → likely `chore`

---

## Phase 2: Technical Analysis

Use Task(Explore) to analyze codebase:

```
SEARCH for:
- Related code patterns
- Similar existing features
- Affected files
- API endpoints involved
- Database schemas touched

OUTPUT:
Technical Analysis:

Affected Files:
- `{file1}` - {expected changes}
- `{file2}` - {expected changes}

Existing Patterns:
- {pattern} in `{file}` - {relevance}

Suggested Approach:
{high-level implementation strategy}
```

---

## Phase 3: Dependency Detection

```
ANALYZE:
- Code imports and exports
- API calls (fetch, axios)
- Database queries
- Other tasks in queue

OUTPUT:
Dependencies:

Code:
- `{file}` - {reason} ({risk} risk)

API:
- {endpoint} - {status}

Blocking Tasks:
- {taskId}: {title} ({status})

Infrastructure:
- {service} - {purpose}
```

---

## Phase 4: User Story Generation

```
GENERATE user story in format:
"As a {role}, I want to {action} so that {benefit}."

GENERATE 3-7 acceptance criteria:
- [ ] When {action}, then {expected result}

OUTPUT:
## User Story

As a **{role}**, I want to **{action}** so that **{benefit}**.

## Acceptance Criteria

- [ ] {AC-1}
- [ ] {AC-2}
- [ ] {AC-3}
...

## Definition of Done

- [ ] Code reviewed
- [ ] Tests pass
- [ ] Documentation updated
- [ ] Deployed to staging
```

---

## Phase 5: LLM Prompt Generation

Generate a copy-paste ready prompt for any AI assistant (Claude, ChatGPT, Copilot, Gemini, Cursor, etc.):

```
OUTPUT:
## LLM Prompt (Copy & Paste Ready)

Use this prompt with your preferred AI assistant:

\`\`\`
## Task: {title}

### Context
I'm working on a codebase with the following structure:
- Stack: {tech stack}
- Key directories: {relevant directories}

### Problem
{problem description}

### What needs to be done
{numbered instructions}

### Files to modify
{file list with expected changes}

### Reference implementation
{patterns to follow with file paths}

### Acceptance criteria
{checklist format}

### How to verify
{verification steps}
\`\`\`
```

---

## Final Output

### PM/PO View

```markdown
## {TYPE_EMOJI} {TYPE}: {Title}

**Priority:** {priority_emoji} {priority}
**Complexity:** {complexity} ({story_points} points)
**Labels:** {labels}

### User Story
{formatted_user_story}

### Acceptance Criteria
{acceptance_criteria}

### Dependencies
{dependencies_summary}

### Impact
{impact_analysis}
```

### Developer View

```markdown
## Technical Context

### Affected Files
{affected_files}

### Pattern to Follow
{existing_patterns}

### Implementation Notes
{technical_notes}

### LLM Prompt (Copy & Paste Ready)

Use with any AI assistant (Claude, ChatGPT, Copilot, Gemini, Cursor, etc.):

\`\`\`
{llm_prompt}
\`\`\`
```

---

## Step 6: Save & Sync

```
# Save locally
WRITE to {globalPath}/storage/enriched-tasks/{id}.json

# If issue tracker configured
IF issueTracker.enabled AND issueTracker.enrichment.updateProvider:
  USE AskUserQuestion:
    question: "Update issue in {provider}?"
    options:
      - "Yes, update description"
      - "No, keep local only"

  IF yes:
    UPDATE issue description with enriched content
    OUTPUT: "Updated {issueId} in {provider}"

# Log event
APPEND to {globalPath}/memory/events.jsonl:
{"timestamp":"{now}","action":"task_enriched","id":"{id}","type":"{type}"}
```

---

## Output Format

```
✅ Enriched: {title}

Type: {type} | Priority: {priority} | Complexity: {complexity}
AC: {count} criteria | Files: {count} affected

Ready for dev: {yes/no}
{blockers if any}

Next: `p. task {id}` to start working
```

---

## Error Handling

| Error | Action |
|-------|--------|
| No input | "Usage: `p. enrich <title or issue ID>`" |
| Issue not found | "Issue {ID} not found in {provider}" |
| No codebase context | Use quick enrichment without technical analysis |
| Low confidence | Flag for manual review |

---

## Examples

### From Title
```
p. enrich "Login doesn't work on mobile"
```

### From Issue ID
```
p. enrich ENG-123
```

### Output
```
✅ Enriched: Login doesn't work on mobile

Type: bug | Priority: high | Complexity: small (2 pts)
AC: 4 criteria | Files: 3 affected

Ready for dev: ✓

Next: `p. task ENG-123` to start working
```
