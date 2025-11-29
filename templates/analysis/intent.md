---
name: intent-detection
description: Detect user intent from natural language
allowed-tools: []
---

# Intent Detection

Analyze user input to determine their intent and map to appropriate action.

## Input
- User message: {{message}}

## Intent Categories

### Work Intents
- **start_task**: User wants to begin working on something
- **complete_task**: User finished current work
- **ship**: User wants to release/deploy
- **pause**: User needs to pause current work

### Planning Intents
- **add_feature**: User has a new feature idea
- **add_idea**: Quick thought to capture
- **add_bug**: Report a problem
- **view_queue**: See what's next

### Status Intents
- **check_progress**: View metrics/status
- **get_recap**: Project overview
- **get_help**: Need guidance

### System Intents
- **sync**: Update project state
- **analyze**: Analyze codebase
- **cleanup**: Clean up files

## Analysis

Look for semantic meaning, not keywords:
- "I'm done" → complete_task
- "Let's ship this" → ship
- "Quick thought..." → add_idea
- "What should I do?" → get_help OR view_queue

## Output Format

Return JSON:
```json
{
  "intent": "<intent_name>",
  "confidence": <0.0-1.0>,
  "parameters": {
    "task": "<extracted task if any>",
    "feature": "<extracted feature if any>"
  },
  "suggestedCommand": "/p:<command>"
}
```

## Guidelines

- Use semantic understanding, not regex
- Extract relevant parameters
- High confidence (>0.8) for clear intents
- Ask for clarification if < 0.5
