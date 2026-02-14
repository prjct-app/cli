# Custom Workflows Implementation

**Status**: ✅ Complete
**Date**: 2026-02-13
**Test Coverage**: 21 tests, all passing

## Overview

Implemented custom workflows with dynamic template generation, allowing users to create project-specific workflows beyond the built-in `task`, `done`, `ship`, and `sync` commands.

## What Was Implemented

### Phase 1: Storage Foundation ✅

**Database Migration v4** (`core/storage/database.ts`)
- Created `custom_workflows` table with columns:
  - `id`, `name`, `description`, `created_at`, `updated_at`
  - `is_builtin` (prevents deletion of built-in workflows)
  - `enabled` (soft-delete flag for data integrity)
  - `metadata` (JSON blob for extensibility)
- Seeded 4 built-in workflows: `task`, `done`, `ship`, `sync`

**Custom Workflow Storage** (`core/storage/custom-workflow-storage.ts`)
- CRUD operations: `createWorkflow()`, `getWorkflow()`, `getAllWorkflows()`, `updateWorkflow()`, `deleteWorkflow()`
- Name validation: lowercase alphanumeric + hyphens only
- Reserved name checking (built-in workflows + command verbs)
- Built-in workflow protection
- Soft delete via `enabled` flag

**Workflow Rule Validation** (`core/storage/workflow-rule-storage.ts`)
- Updated `getRulesForCommand()` to validate workflow exists and is enabled
- Returns empty array for disabled or non-existent workflows

### Phase 2: CLI Commands ✅

**Intent Detection** (`core/commands/workflow.ts`)
- Added intent types: `create`, `list`, `delete`, `run`
- Bilingual patterns (English/Spanish) for natural language parsing

**Workflow Lifecycle Methods**
- `_workflowCreate()`: Create custom workflow with validation
- `_workflowList()`: List all workflows (built-in + custom)
- `_workflowDelete()`: Delete custom workflow (soft delete)
- `run()`: Execute custom workflow through workflow engine

**Removed Hardcoded Validation** (lines 912, 960)
- Replaced `['task', 'done', 'ship', 'sync']` checks with dynamic workflow lookup
- Now supports any enabled workflow from `custom_workflows` table

### Phase 3: Template Auto-Generation ✅

**Template Generator** (`core/infrastructure/template-generator.ts`)
- Dynamically generates workflow templates at `~/.claude/commands/p/{name}.md`
- Templates are thin wrappers that call `prjct run {workflow} --md`
- Preserves agentic intelligence (explore, ask, plan capabilities)
- Automatic cleanup on workflow deletion

**Integration**
- `_workflowCreate()` generates template on workflow creation
- `_workflowDelete()` removes template file
- Rollback on template generation failure

### Phase 4: Agentic Configuration ⏭️ (Deferred)

**Status**: Skipped for MVP
- Not required for core functionality
- Users can manually add rules using existing `prjct workflow add` commands
- Can be implemented later as an enhancement:
  - Auto-detect project commands (lint, test, build)
  - Suggest workflow improvements based on stack detection
  - Smart defaults for common workflows (qa, deploy, release)

### Phase 5: Workflow Execution ✅

**Run Command** (`core/commands/workflow.ts` - `run()` method)
- Validates workflow exists and is enabled
- Executes before phase (gates + steps + hooks)
- Executes after phase (hooks only)
- Markdown output support via `--md` flag
- Proper error handling and user feedback

### Phase 6: Template Integration ✅

**Updated Workflow Template** (`templates/commands/workflow.md`)
- Added Step 2: Workflow Lifecycle
  - Creating workflows: name validation, description prompts
  - Listing workflows: show built-in vs custom
  - Deleting workflows: confirmation, built-in protection
- Updated intent handling to support new commands

## Usage Examples

### Create a QA Workflow

```bash
# Create custom workflow
prjct workflow create qa "Quality assurance checks"

# Add rules
prjct workflow add "npm run lint" before qa
prjct workflow add "npm test" before qa

# Run workflow
p. qa
```

### List All Workflows

```bash
prjct workflow list --md
```

Output:
```
Built-in Workflows
- task — Start working on a task
- done — Complete current task/subtask
- ship — Ship feature with version bump and PR
- sync — Analyze project and regenerate context

Custom Workflows
- qa — Quality assurance checks
- deploy — Deploy to production
```

### Delete Custom Workflow

```bash
prjct workflow delete qa --md
```

### Architecture Decisions

**1. Template Storage Location: Global (`~/.claude/commands/p/`)**
- Rationale: Templates are AI execution instructions, not project data
- Project-specific behavior controlled by `workflow_rules` in SQLite

**2. Built-in vs Custom Distinction: `is_builtin` flag**
- Benefits:
  - Built-in workflows cannot be deleted
  - Custom workflows can be deleted
  - Unified storage model

**3. Soft Delete: `enabled` flag**
- Preserves foreign key integrity with `workflow_rules`
- Allows re-enabling workflows
- Maintains audit trail

**4. Naming Restrictions: `^[a-z0-9-]+$`**
- Reserved: `task`, `done`, `ship`, `sync` (built-in)
- Reserved: `add`, `rm`, `gate`, `list`, `create`, `delete`, `run`, `help`, `reset`, `init` (verbs)

## Testing

**Test File**: `core/__tests__/storage/custom-workflow-storage.test.ts`
- 21 tests, all passing
- Coverage:
  - Built-in workflow seeding and protection
  - Custom workflow CRUD operations
  - Name validation and reserved names
  - Soft delete behavior
  - Enabled/disabled filtering
  - Metadata handling

**Type Safety**: ✅ No TypeScript errors

**Integration**: ✅ No breaking changes to existing tests (1103 pass, 1 unrelated timeout)

## Files Modified

### New Files
- `core/storage/custom-workflow-storage.ts` - CRUD operations
- `core/infrastructure/template-generator.ts` - Dynamic template generation
- `core/__tests__/storage/custom-workflow-storage.test.ts` - Test suite

### Modified Files
- `core/storage/database.ts` - Migration v4
- `core/storage/workflow-rule-storage.ts` - Workflow validation
- `core/commands/workflow.ts` - CLI commands, intent detection, execution
- `templates/commands/workflow.md` - Updated workflow template

## Next Steps (Future Enhancements)

1. **Agentic Auto-Configuration** (Phase 4)
   - Create `core/workflow/workflow-configurator.ts`
   - Auto-detect project commands and suggest rules
   - Smart defaults for common workflows (qa, deploy, etc.)

2. **Workflow Templates Library**
   - Pre-built workflow configurations (qa, e2e, release)
   - One-command workflow installation: `prjct workflow install qa-standard`

3. **Workflow Dependencies**
   - Allow workflows to depend on other workflows
   - Composite workflows: `qa-full` → `lint` + `test` + `e2e`

4. **Workflow Analytics**
   - Track workflow execution times
   - Success/failure rates
   - Performance metrics per workflow

## Migration Path

For existing projects:
1. Migration v4 runs automatically on first `prjct` command
2. Built-in workflows seeded with `is_builtin=1`
3. No action required from users
4. Existing workflow rules continue to work

## Rollback

If issues arise:
1. Custom workflows are isolated in `custom_workflows` table
2. Built-in workflows remain functional
3. Can disable custom workflows via `enabled=0`
4. Template files at `~/.claude/commands/p/*.md` can be manually removed
