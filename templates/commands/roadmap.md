---
allowed-tools: [Read, Write]
description: 'Strategic roadmap management'
---

# /p:roadmap

## Usage

```
/p:roadmap [show|add|complete|next]  # Default: show
```

## Flow

1. Parse: action (show/add/complete/next)
2. **Read index**: `planning/roadmap.md` (last 30 days)
3. **Read sessions**: Last 3-7 days from `planning/sessions/{YYYY-MM}/` for details
4. Execute: based on action
5. Update: roadmap index if needed
6. Archive: entries > 30 days to `planning/archive/roadmap-{YYYY-MM}.md`

## Query Sessions

To get complete roadmap history or specific date range:

```javascript
// Read sessions for date range
const sessions = await readSessions('planning/sessions', startDate, endDate)
const features = sessions.filter(s => s.type === 'feature_add')
```

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
