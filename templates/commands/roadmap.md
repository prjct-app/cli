---
allowed-tools: [Read, Write]
description: "Strategic roadmap management"
---

# /p:roadmap

## Usage
```
/p:roadmap [show|add|complete|next]  # Default: show
```

## Flow
1. Parse: action (show/add/complete/next)
2. Read: `planning/roadmap.md`
3. Execute: based on action
4. Update: roadmap file if needed

## Response (show)
```
📍 PRODUCT ROADMAP

🚀 Current Sprint ({X}% complete)
├── ✅ {feature}
├── 🔄 {feature} (in progress)
└── ⏳ {feature}

📅 Next Up ({N} features)
├── {feature}
└── {feature}

📊 Progress:
• Velocity: {X.X} features/week
• On track: {date}

/p:now "{next_feature}"
```

