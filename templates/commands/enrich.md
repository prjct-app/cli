---
allowed-tools: [Read, Write, Bash, Task, Glob, Grep, AskUserQuestion]
description: 'Enrich tickets with technical PRD using architect codebase analysis'
---

# p. enrich - AI-Powered Ticket Enrichment

Transform vague PM tickets into detailed technical PRDs using codebase context.

## The Problem

PMs/POs create tickets without codebase context:
- Missing implementation details
- Inaccurate estimations (PMs don't know the codebase)
- Wrong classification (bug vs feature)
- No acceptance criteria
- Not actionable for developers
- Can't be used effectively with AI tools

## The Solution

The architect analyzes the codebase and enriches tickets with:
- Technical implementation approach
- Real complexity estimation (developer-informed)
- Correct Agile/Scrum classification
- Detailed acceptance criteria
- LLM-friendly prompt for ANY AI tool (Claude, ChatGPT, Copilot, Gemini, Cursor)

---

## Context Variables

- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{input}`: Ticket ID (PRJ-59, PROJ-123, #42) or title text

---

## Subcommands

| Command | Description |
|---------|-------------|
| `p. enrich <ID>` | Enrich a specific ticket from tracker |
| `p. enrich "<title>"` | Enrich from text description |
| `p. enrich setup` | Configure enrichment preferences |
| `p. enrich batch` | Enrich all assigned tickets (backlog grooming) |

---

## Supported Trackers

| Tracker | ID Pattern | MCP Tools |
|---------|------------|-----------|
| **Linear** | `PRJ-123` | `mcp__linear__*` |
| **JIRA** | `PROJ-123` | `mcp__atlassian__jira_*` |
| **GitHub Issues** | `#123` | `mcp__github__*` |
| **Monday.com** | Board item | `mcp__monday__*` |

---

## Step 1: Validate Project & Detect Tracker

```
READ: .prjct/prjct.config.json
EXTRACT: projectId
SET: globalPath = ~/.prjct-cli/projects/{projectId}

IF file not found:
  OUTPUT: "No prjct project. Run `p. init` first."
  STOP

DETECT tracker from input format:
- Pattern /^[A-Z]{2,5}-\d+$/ (PRJ-123) → Check Linear first, then JIRA
- Pattern /^#?\d+$/ (#123 or 123) → GitHub Issues
- Quoted text → Title mode (no tracker fetch)

CHECK: Is the tracker MCP configured?
- Linear: mcp__linear__* tools
- JIRA: mcp__atlassian__jira_* tools
- GitHub: mcp__github__* tools
- Monday: mcp__monday__* tools

IF tracker detected but not configured:
  OUTPUT: "Tracker not configured. Run `p. {tracker} setup` first."
  STOP
```

---

## Step 2: Fetch Original Ticket (if from tracker)

### Linear
```
USE TOOL: mcp__linear__get_issue
PARAMS: { "issueId": "{ID}" }
```

### JIRA
```
USE TOOL: mcp__atlassian__jira_get_issue
PARAMS: { "issueKey": "{ID}" }
```

### GitHub
```
USE TOOL: mcp__github__get_issue
PARAMS: { "owner": "{owner}", "repo": "{repo}", "issue_number": {NUM} }
```

### Monday
```
USE TOOL: mcp__monday__get_board_items_by_name
PARAMS: { "boardId": "{boardId}" }
```

### Extract
```
EXTRACT from response:
- title
- description (may be empty or vague - THE PROBLEM)
- current labels/type
- assignee
- priority
- reporter/created_by (PM/PO name)
- existing comments
```

---

## Step 3: Architect Analysis (CRITICAL)

This is where the magic happens. The architect analyzes the codebase with full context.

### 3.1 Use Explore Agent

```
USE TOOL: Task
SUBAGENT_TYPE: Explore
THOROUGHNESS: very thorough
PROMPT: |
  Analyze the codebase to understand how to implement this ticket:

  **Ticket**: {title}
  **Current Description**: {description}
  **Reporter**: {reporter} (may lack codebase context)

  Find and analyze:

  1. **Similar Implementations**
     - Find existing code that does something similar
     - Identify patterns we should follow
     - Note any reusable components/functions

  2. **Affected Files**
     - Which files will need modification?
     - Estimate scope of changes per file
     - Identify test files that need updates

  3. **Dependencies & Integrations**
     - External APIs involved
     - Database schema changes needed
     - Third-party services touched

  4. **Risks & Blockers**
     - What could go wrong?
     - Are there any blockers?
     - Breaking changes to consider?

  5. **Testing Requirements**
     - What needs unit tests?
     - What needs integration tests?
     - Manual QA scenarios

  Be thorough - this analysis drives the PRD accuracy.
```

### 3.2 Load Domain Agents (if available)

```
CHECK: {globalPath}/agents/ exists?

FOR EACH relevant agent based on ticket type:
  - frontend.md → If UI changes
  - backend.md → If API/server changes
  - database.md → If DB changes
  - testing.md → Always for test strategy

READ and incorporate domain-specific insights.
```

---

## Step 4: Intelligent Classification

### 4.1 Issue Type Detection

```
ANALYZE title, description, and codebase context:

SIGNALS for Bug:
- "broken", "not working", "error", "crash", "fix", "issue"
- Exception traces in description
- "was working before", "regression"
→ TYPE = "Bug"

SIGNALS for Story/Feature:
- "add", "new", "create", "implement", "build"
- New capability for users
- Requires design decisions
→ TYPE = "Story"

SIGNALS for Improvement:
- "improve", "enhance", "better", "faster", "optimize"
- Existing feature works but needs upgrade
→ TYPE = "Improvement"

SIGNALS for Spike/Research:
- "research", "investigate", "explore", "POC", "prototype"
- "evaluate", "compare options"
→ TYPE = "Spike"

SIGNALS for Chore:
- "refactor", "cleanup", "technical debt"
- "update deps", "config change"
- No user-facing impact
→ TYPE = "Chore"

DEFAULT:
→ TYPE = "Task"
```

### 4.2 Get Team's Estimation Framework

```
READ: {globalPath}/config/enrichment.json

IF not configured:
  ASK: "How does your team estimate work?"
  OPTIONS:
    - "Story Points (Fibonacci: 1,2,3,5,8,13,21)" (Recommended)
    - "T-Shirt Sizing (XS, S, M, L, XL)"
    - "Hours (not recommended but common)"
    - "Custom scale"
    - "No estimation"

  IF custom:
    ASK: "Enter your estimation scale (comma-separated)"

  SAVE to {globalPath}/config/enrichment.json
```

### 4.3 Calculate Complexity & Estimation

Based on architect analysis:

```
factors = {
  files_affected: {count from analysis},
  has_db_changes: {boolean from analysis},
  has_api_changes: {boolean from analysis},
  has_ui_changes: {boolean from analysis},
  external_dependencies: {count from analysis},
  similar_code_exists: {boolean from analysis},
  test_coverage_needed: {low|medium|high},
  risk_level: {low|medium|high}
}

# Story Points (Fibonacci)
IF files_affected <= 2 AND similar_code_exists AND risk_level == "low":
  complexity = "Low"
  points = 1-2
  tshirt = "XS-S"

ELSE IF files_affected <= 4 AND NOT has_db_changes:
  complexity = "Medium"
  points = 3-5
  tshirt = "M"

ELSE IF files_affected <= 7 OR has_db_changes OR has_api_changes:
  complexity = "High"
  points = 8
  tshirt = "L"

ELSE IF files_affected > 7 OR external_dependencies > 2 OR risk_level == "high":
  complexity = "Very High"
  points = 13
  tshirt = "XL"

ELSE:
  complexity = "Epic - Should be broken down"
  points = 21+
  tshirt = "XXL"

OUTPUT estimation in team's preferred format.
```

---

## Step 5: Generate Technical PRD

Based on architect analysis, generate a structured PRD.

### PRD Template

```markdown
## 🎯 Technical PRD: {title}

### Overview
{One paragraph explaining what this achieves, written by someone who understands the codebase}

### Classification
| Attribute | Value |
|-----------|-------|
| **Type** | {Bug \| Story \| Task \| Spike \| Improvement \| Chore} |
| **Estimation** | {X points \| T-shirt size} |
| **Complexity** | {Low \| Medium \| High \| Very High} |
| **Risk** | {Low \| Medium \| High} |
| **Priority** | {Critical \| High \| Medium \| Low} |

### Original vs Enriched

| Original Ticket | Enriched Understanding |
|-----------------|------------------------|
| {original title/description} | {what it really means technically} |

---

### Implementation Approach

#### Recommended: {Approach Name}

{Detailed description with rationale}

**Why this approach:**
- {reason 1}
- {reason 2}

**Files to modify:**
| File | Changes | Effort |
|------|---------|--------|
| `{file1}` | {what changes} | {low/med/high} |
| `{file2}` | {what changes} | {low/med/high} |

**Pattern to follow:**
Reference: `{similar_file}:{line_number}`
```
{code snippet of pattern}
```

#### Alternative: {Other Approach} (if applicable)

{Brief description for team discussion}

**Trade-offs:** {pros and cons}

---

### Acceptance Criteria

**Must Have:**
- [ ] {Specific, testable criterion 1}
- [ ] {Specific, testable criterion 2}
- [ ] {Specific, testable criterion 3}

**Should Have:**
- [ ] {Nice to have criterion}

**Definition of Done:**
- [ ] Code reviewed and approved
- [ ] Tests pass (unit + integration)
- [ ] No regressions in CI
- [ ] Documentation updated (if applicable)

---

### Dependencies

**Requires (blockers):**
- {Blocker 1 if any}

**Related tickets:**
- {Related ID}: {title}

**External services:**
- {Service}: {How it's used}

---

### Testing Strategy

| Type | What to Test | Files |
|------|--------------|-------|
| Unit | {Component/function} | `{test_file}` |
| Integration | {Flow/API} | `{test_file}` |
| Manual QA | {Scenario} | N/A |

**Edge cases to cover:**
- {Edge case 1}
- {Edge case 2}

---

### Out of Scope

- {Explicitly what this does NOT include}
- {Future work that should be separate tickets}

---

### 🤖 LLM Implementation Prompt

**Copy-paste this prompt into any AI assistant:**

```
## Task: {title}

### Context
- Codebase: {language/framework from analysis}
- Related files: {key files}
- Pattern to follow: `{pattern_file}:{line}` (see attached/referenced)

### Requirements
{Acceptance criteria as bullet points}

### Implementation Steps
1. {Step 1 from approach}
2. {Step 2}
3. {Step 3}

### Constraints
- Follow existing patterns in {pattern_file}
- Maintain backwards compatibility with {specific thing}
- Tests required in {test_file}

### Verification
{How to verify it works}

Start by reading {first_file}, then implement changes.
```

---

*Generated by prjct architect | {timestamp}*
*Original ticket lacked: {what_was_missing}*
*Confidence: {high|medium|low} based on codebase analysis*
```

---

## Step 6: Confirm Publication Target (ALWAYS ASK)

**Never publish without confirmation.**

```
ASK: "Where should I publish this PRD for {ID}?"
OPTIONS:
  - "Add as comment" - Preserves original, adds PRD as comment (Recommended)
  - "Update description" - Replaces original description with PRD
  - "Both" - Comment + update description
  - "Just show me" - Preview only, don't publish

STORE preference if user says "remember my choice"
```

---

## Step 7: Publish to Tracker

### Linear

```
# Comment (most common)
USE TOOL: mcp__linear__create_comment
PARAMS:
  issueId: "{uuid}"
  body: "{PRD markdown}"

# Update description (if selected)
USE TOOL: mcp__linear__update_issue
PARAMS:
  issueId: "{uuid}"
  description: "{PRD markdown}"

# Update labels/estimate
USE TOOL: mcp__linear__update_issue
PARAMS:
  issueId: "{uuid}"
  estimate: {points}  # If team uses Linear estimates
```

### JIRA

```
# Comment
USE TOOL: mcp__atlassian__jira_add_comment
PARAMS:
  issueKey: "{ID}"
  body: "{PRD markdown}"

# Update description
USE TOOL: mcp__atlassian__jira_update_issue
PARAMS:
  issueKey: "{ID}"
  fields:
    description: "{PRD markdown}"

# Update story points (if field exists)
USE TOOL: mcp__atlassian__jira_update_issue
PARAMS:
  issueKey: "{ID}"
  fields:
    customfield_10016: {points}  # Common story points field
```

### GitHub Issues

```
# Comment
USE TOOL: mcp__github__create_issue_comment
PARAMS:
  owner: "{owner}"
  repo: "{repo}"
  issue_number: {NUM}
  body: "{PRD markdown}"

# Update description
USE TOOL: mcp__github__update_issue
PARAMS:
  owner: "{owner}"
  repo: "{repo}"
  issue_number: {NUM}
  body: "{PRD markdown}"

# Update labels for type
USE TOOL: mcp__github__update_issue
PARAMS:
  labels: ["{type}", "{priority}", "enriched"]
```

### Monday.com

```
# Create update (comment)
USE TOOL: mcp__monday__create_update
PARAMS:
  itemId: "{id}"
  body: "{PRD markdown}"

# Update columns
USE TOOL: mcp__monday__change_item_column_values
PARAMS:
  boardId: "{boardId}"
  itemId: "{id}"
  columnValues: { "status": "Ready for Dev", "numbers": {points} }
```

---

## Step 8: Save Locally & Log

```
# Save enriched task
WRITE to {globalPath}/storage/enriched/{id}.json:
{
  "id": "{id}",
  "tracker": "{tracker}",
  "originalTitle": "{original_title}",
  "originalDescription": "{original_desc}",
  "enrichedAt": "{timestamp}",
  "classification": {
    "type": "{type}",
    "estimation": "{points}",
    "complexity": "{complexity}",
    "risk": "{risk}"
  },
  "analysis": {
    "filesAffected": [{files}],
    "patternsFound": [{patterns}],
    "dependencies": [{deps}]
  },
  "prd": "{full_prd_markdown}",
  "llmPrompt": "{extracted_llm_prompt}",
  "publishedTo": "{comment|description|both|none}"
}

# Log event
APPEND to {globalPath}/memory/events.jsonl:
{
  "timestamp": "{ISO timestamp}",
  "event": "ticket_enriched",
  "ticketId": "{ID}",
  "tracker": "{linear|jira|github|monday}",
  "classification": {
    "type": "{type}",
    "estimation": "{points}",
    "complexity": "{complexity}"
  },
  "originalHadDescription": {boolean},
  "confidenceLevel": "{high|medium|low}",
  "publishedTo": "{target}"
}
```

---

## Subcommand: setup

Configure team preferences for enrichment.

```
ASK: "How does your team estimate work?"
OPTIONS:
  - Story Points (Fibonacci: 1,2,3,5,8,13,21) - Recommended
  - T-Shirt Sizing (XS, S, M, L, XL)
  - Hours
  - Custom scale
  - No estimation

ASK: "Default publication target?"
OPTIONS:
  - Always ask (Recommended)
  - Comment only
  - Update description

ASK: "Include LLM prompt in PRD?"
OPTIONS:
  - Yes (Recommended) - Helps team use any AI tool
  - No - Just technical details

SAVE to {globalPath}/config/enrichment.json:
{
  "estimationFramework": "story-points",
  "scale": [1, 2, 3, 5, 8, 13, 21],
  "defaultPublishTarget": "ask",
  "includeLLMPrompt": true,
  "teamPreferences": {
    "requireAcceptanceCriteria": true,
    "requireTestStrategy": true,
    "maxPointsBeforeSplit": 13
  },
  "setupAt": "{timestamp}"
}
```

---

## Subcommand: batch

Enrich multiple tickets for backlog grooming.

```
1. Fetch all assigned tickets from configured tracker
2. Filter out:
   - Already enriched (check for "Generated by prjct" marker)
   - Closed/Done tickets
3. Show list and ask confirmation:
   "Found {count} tickets to enrich. Proceed?"
4. For each ticket:
   - Run enrichment flow
   - Ask publication target (or use default)
   - Brief pause between to avoid rate limits
5. Summary at end

OUTPUT:
📋 Batch Enrichment Complete

Enriched {count} tickets:
✅ PRJ-59 - Add user auth (Story, 8 pts)
✅ PRJ-60 - Fix login bug (Bug, 3 pts)
✅ PRJ-61 - Update deps (Chore, 1 pt)
⏭️ PRJ-62 - Already enriched (skipped)

Total estimation: {sum} story points
Avg complexity: {avg}

Next: Sprint planning with accurate estimates!
```

---

## Config Storage

| What | Where |
|------|-------|
| Team preferences | `{globalPath}/config/enrichment.json` |
| Enriched tasks | `{globalPath}/storage/enriched/{id}.json` |
| Event log | `{globalPath}/memory/events.jsonl` |

---

## Output Format

```
✅ Enriched: {ID} - {title}

Classification:
  Type: {original_type} → {correct_type}
  Estimation: {points} ({complexity})
  Risk: {risk_level}

Analysis:
  Files: {count} affected
  Patterns: Found in `{file}`
  Dependencies: {count}

Published: {comment|description|both|preview only}

---
📋 PRD Preview:
{first 10 lines of PRD}
...

Next: `p. {tracker} start {ID}` to begin work
```

---

## Error Handling

| Error | Action |
|-------|--------|
| Ticket not found | "Ticket {ID} not found. Check format: PRJ-123 (Linear), PROJ-123 (JIRA), #123 (GitHub)" |
| Tracker not configured | "Run `p. {tracker} setup` first." |
| No codebase context | "Run `p. sync` first to analyze codebase." |
| MCP tools unavailable | Show MCP config instructions for that tracker |
| Already enriched | "Ticket has PRD. Re-enrich to update? (y/n)" |
| Rate limited | "Rate limited by {tracker}. Wait and retry." |

---

## Why This Matters

| Before Enrichment | After Enrichment |
|-------------------|------------------|
| "Add user auth" | Full PRD: OAuth2 approach, 5 files, 8 criteria |
| PM guessed "2 days" | Architect: 8 points based on actual complexity |
| Labeled as "Task" | Correctly classified as "Story" |
| Developer asks "how?" | Implementation approach with pattern reference |
| Only works with Claude | LLM-ready prompt for ANY AI tool |
| Sprint fails estimation | Accurate velocity tracking |

---

## Best Practices

1. **Run `p. sync` first** - Enrichment needs codebase analysis
2. **Enrich before sprint planning** - Get accurate estimations
3. **Use batch for backlog grooming** - Process entire backlog
4. **Keep LLM prompt** - Team can use Claude, ChatGPT, Copilot, anyone
5. **Review classification** - Override if architect got it wrong
6. **Split big tickets** - If estimation > 13, suggest breakdown
