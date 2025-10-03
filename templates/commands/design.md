---
allowed-tools: [Read, Write]
description: "Design architecture and APIs"
---

# /p:design

## Usage
```
/p:design [target] [--type architecture|api|component|database|flow]
```

## Flow
1. Parse: target + type
2. Generate: ASCII diagrams
3. Create: specifications
4. Save: `designs/{target}-{type}.md`

## Types
- **architecture**: System design, components, data flow
- **api**: Endpoint specs, schemas, auth
- **component**: Interfaces, props, state
- **database**: Schema, relationships, indexes
- **flow**: User journeys, workflows

## Response
```
🎨 Design complete!

📐 {target} - {type}
📄 Saved: designs/{target}-{type}.md

/p:now "Implement {target}"
```

