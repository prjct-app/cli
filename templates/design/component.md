---
name: component-design
description: Design UI/code component
allowed-tools: [Read, Glob, Grep]
---

# Component Design

Design a reusable component for the given requirements.

## Input
- Target: {{target}}
- Requirements: {{requirements}}

## Analysis Steps

1. **Understand Purpose**
   - What does this component do?
   - Where will it be used?
   - What inputs/outputs?

2. **Review Existing Components**
   - Read similar components
   - Match project patterns
   - Use existing utilities

3. **Design Interface**
   - Props/parameters
   - Events/callbacks
   - State management

4. **Plan Implementation**
   - File structure
   - Dependencies
   - Testing approach

## Output Format

```markdown
# Component: {ComponentName}

## Purpose
Brief description of what this component does.

## Props/Interface
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| id | string | yes | - | Unique identifier |
| onClick | function | no | - | Click handler |

## State
- `isLoading`: boolean - Loading state
- `data`: array - Fetched data

## Events
- `onChange(value)`: Fired when value changes
- `onSubmit(data)`: Fired on form submit

## Usage Example
```jsx
<ComponentName
  id="example"
  onClick={handleClick}
/>
```

## File Structure
```
components/
└── ComponentName/
    ├── index.js
    ├── ComponentName.jsx
    ├── ComponentName.test.js
    └── styles.css
```

## Dependencies
- Library X for Y
- Utility Z

## Testing
- Unit tests for logic
- Integration test for interactions
```

## Guidelines
- Match project component patterns
- Keep components focused
- Document all props
