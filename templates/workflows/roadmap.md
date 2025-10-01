---
title: prjct roadmap
invocable_name: p:roadmap
description: Show or update strategic roadmap using global prjct architecture
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` from config
3. Read roadmap from `~/.prjct-cli/projects/{projectId}/planning/roadmap.md`
4. Parse roadmap structure (phases, milestones, features)
5. Read shipped features from `~/.prjct-cli/projects/{projectId}/progress/shipped.md`
6. Calculate completion progress for each phase
7. Identify current phase and next milestones
8. Format and display roadmap with progress

# Response Format

```
🗺️  Project Roadmap

📍 Current Phase: {phase name}
Progress: {X}% complete

## Phases Overview

### ✅ Phase 1: {name} (Completed)
- {feature 1} ✓
- {feature 2} ✓
- {feature 3} ✓

### 🔄 Phase 2: {name} (In Progress - {X}%)
- {feature 1} ✓
- {feature 2} 🔄 Current
- {feature 3} ⏳
- {feature 4} ⏳

### ⏳ Phase 3: {name} (Planned)
- {feature 1}
- {feature 2}
- {feature 3}

### 💡 Phase 4: {name} (Future)
- {feature 1}
- {feature 2}

## Upcoming Milestones

🎯 Next Milestone: {milestone name}
  - Target: {date/timeframe}
  - Features remaining: X
  - Estimated: Y weeks

🔮 Future Milestones:
  - {milestone 2}: {timeframe}
  - {milestone 3}: {timeframe}

💡 Want to update roadmap? Edit ~/.prjct-cli/projects/{id}/planning/roadmap.md
```

# Roadmap Structure

The roadmap.md file should follow this structure:

```markdown
# Project Roadmap

## Phase 1: Foundation
Target: Q1 2025
- [ ] Feature A
- [ ] Feature B
- [ ] Feature C

## Phase 2: Core Features
Target: Q2 2025
- [ ] Feature D
- [ ] Feature E

...
```

# Progress Calculation

- Match shipped features against roadmap items
- Calculate percentage completion per phase
- Identify current phase (first with incomplete items)
- Estimate completion based on velocity

# Global Architecture Notes

- **Data Location**: `~/.prjct-cli/projects/{id}/planning/roadmap.md`
- **Progress Source**: `~/.prjct-cli/projects/{id}/progress/shipped.md`
- **Config Location**: `{project}/.prjct/prjct.config.json`
- **Use Case**: Strategic planning, stakeholder updates, long-term vision
