---
allowed-tools: [Read, Write]
description: 'Workflow status'
---

# /p:workflow

## Flow
Read `workflow/state.json` → Show progress

## Response
`🔄 {task} | Step {N}/{total}: {step} ({agent}) | Skip: /p:workflow skip`
