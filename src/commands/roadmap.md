---
allowed-tools: [Read, Write, Edit, TodoWrite]
description: 'Strategic planning and feature roadmap management'
---

# /p:roadmap - Strategic Planning

## Purpose

Plan features, track strategic progress, and stay aligned with goals. Zero PM overhead.

## Usage

```
/p:roadmap [show|add|complete|next]
```

Default: show

## Execution

Execute the command silently and show only the final result:

```bash
prjct roadmap
```

The command handles all file operations internally. Show only the final message.
## Implementation

**Roadmap structure** in `.prjct/planning/roadmap.md`:

```markdown
# Product Roadmap

## 🚀 Current Sprint (Week X)

- [x] User authentication
- [ ] Dashboard redesign
- [ ] API optimization

## 📅 Next Up

- [ ] Real-time notifications
- [ ] Data export feature
- [ ] Mobile responsive design

## 🌟 Future Vision

- [ ] AI recommendations
- [ ] Team collaboration
- [ ] Analytics dashboard
```

**Smart prioritization**:

- Impact vs effort matrix
- User value scoring
- Technical dependencies
- Strategic alignment

**Response format for show**:

```
📍 PRODUCT ROADMAP

🚀 Current Sprint (23% complete)
├── ✅ User authentication
├── 🔄 Dashboard redesign (in progress)
└── ⏳ API optimization

📅 Next Up (3 features)
├── Real-time notifications
├── Data export feature
└── Mobile responsive design

📊 Progress Metrics:
• Sprint velocity: 1.4 features/week
• On track for: Dec 15 completion
• Strategic alignment: High

💡 Start next: /p:now "Dashboard redesign"
```

**Response format for add**:

```
✅ Added to roadmap: "Payment integration"

📍 Prioritized as: Next Up #1
⚡ Estimated effort: Medium (3-5 days)
🎯 Impact score: High
🔗 Dependencies: User authentication ✅

📋 Updated roadmap in .prjct/planning/roadmap.md
```

## Features

- Visual progress tracking
- Smart prioritization
- Sprint management
- Velocity tracking
- Strategic alignment
