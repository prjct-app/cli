---
allowed-tools: [Read, Write, Edit, TodoWrite]
description: "Strategic planning and feature roadmap management"
---

## Global Architecture
This command uses the global prjct architecture:
- Data stored in: `~/.prjct-cli/projects/{id}/`
- Config stored in: `{project}/.prjct/prjct.config.json`
- Commands synchronized across all editors



# /p:roadmap - Strategic Planning

## Purpose
Plan features, track strategic progress, and stay aligned with goals. Zero PM overhead.

## Usage
```
/p:roadmap [show|add|complete|next]
```

Default: show

## Execution

### `/p:roadmap` or `/p:roadmap show`
Display current roadmap with progress

### `/p:roadmap add <feature>`
Add feature to roadmap with smart prioritization

### `/p:roadmap complete <feature>`
Mark feature as shipped and celebrate

### `/p:roadmap next`
Show next priority item to work on

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