---
allowed-tools: [Read, Write]
description: "Show workflow status"
---

# /p:workflow

## Usage
```
/p:workflow           # Show status
/p:workflow skip      # Skip current step
```

## Flow
1. Read: `workflow/state.json`
2. Display: current step + progress
3. Check: capabilities for next steps

## Response
```
🔄 Workflow: {task_type}

Progress: {current}/{total}
Current: {step_name} ({agent})
Status: {status}

Next: {next_step}
{capability_prompt_if_needed}

/p:done | /p:workflow skip
```

