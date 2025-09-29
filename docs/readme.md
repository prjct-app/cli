# PRJCT-CLI: Technical & Executive Summary

## Executive Summary

**prjct-cli** is a lightweight project management framework designed specifically for indie hackers, solopreneurs, and side projects. It integrates directly into AI coding assistants (Claude Code, Cursor, Warp) to provide frictionless progress tracking without the ceremonial overhead of traditional project management tools.

**Core Philosophy**: Ship fast, stay focused. No sprints, no story points, no ceremonies - just real progress.

## Technical Architecture

### System Design
- **Type**: AI Assistant Enhancement Framework
- **Integration**: Native MCP (Model Context Protocol) servers
- **Storage**: Local filesystem (.prjct/ directory)
- **Commands**: Slash commands (/p:*) executed within AI context
- **Dependencies**: Minimal - only MCP servers required

### Installation Flow
```
1. Global MCP servers (Context7, Filesystem, Memory)
   ↓
2. Command injection into AI assistant
   ↓
3. Per-project initialization (.prjct/ structure)
   ↓
4. Real-time command execution via AI
```

### Core Components

#### 1. **Command System**
- `/p:init` - Project initialization
- `/p:now [task]` - Current task management
- `/p:next` - Priority queue display
- `/p:done` - Task completion
- `/p:ship <feature>` - Feature shipping & celebration
- `/p:recap` - Progress overview
- `/p:idea <text>` - Idea capture
- `/p:stuck <problem>` - Problem solving assistance

#### 2. **File Structure**
```
.prjct/
├── now.md       # Current focus (single task)
├── next.md      # Prioritized queue
├── shipped.md   # Completed features (wins)
├── ideas.md     # Brain dump
└── memory.jsonl # Decision history
```

#### 3. **MCP Integration**
- **Context7**: Library documentation lookup (prevents hallucination)
- **Filesystem**: Direct file manipulation
- **Memory**: Persistent decision storage
- **Sequential**: Deep reasoning for complex problems

## Value Proposition

### For Developers
- **Zero friction**: Commands within existing workflow
- **Context preservation**: Never lose track after breaks
- **Progress visibility**: See actual shipped features
- **Decision memory**: Remember why choices were made
- **Motivation built-in**: Celebrates wins, tracks momentum

### Metrics That Matter
✅ Features shipped  
✅ Days since last ship  
✅ Task completion velocity  
✅ Ideas → Shipped conversion  
❌ ~~Story points~~  
❌ ~~Hours logged~~  
❌ ~~Burndown charts~~  
❌ ~~Sprint ceremonies~~

## Implementation Instructions for Claude Code

### Installation
```bash
# One-time global setup
curl -sSL https://github.com/yourusername/prjct-cli/install.sh | bash

# What it does:
# 1. Installs MCP servers globally
# 2. Configures Claude Code with prjct commands
# 3. Sets up Context7 documentation database
# 4. Creates ~/.prjct-cli/ configuration
```

### Per-Project Usage
```markdown
# Initialize project (first time)
User: /p:init

Claude: 🚀 Initializing prjct...
✅ Created .prjct/ structure
📊 Detected: Next.js 14, React 18, Supabase
Ready! Start with /p:now "your first task"

# Daily workflow
User: /p:now "implement auth"
Claude: 📍 Focus set: implement auth

User: /p:done
Claude: ✅ Task complete! 
Ready to ship? Use /p:ship if this is a feature

User: /p:ship "authentication system"
Claude: 🚀 SHIPPED! 🎉
Total shipped: 1
You're on fire! 🔥

# Check progress
User: /p:recap
Claude: 📊 Project Recap
🎯 Current: payment integration
📦 Shipped: 3 features this week
📝 Queued: 5 tasks
Keep shipping! You're doing great!
```

## Command Reference

### Work Commands
| Command | Purpose | Example |
|---------|---------|---------|
| `/p:now [task]` | Set/show current task | `/p:now "add payment"` |
| `/p:next` | Show priority queue | `/p:next` |
| `/p:done` | Complete current task | `/p:done` |
| `/p:ship <feature>` | Ship & celebrate | `/p:ship "checkout flow"` |

### Planning Commands
| Command | Purpose | Example |
|---------|---------|---------|
| `/p:idea <text>` | Capture idea quickly | `/p:idea "add AI search"` |
| `/p:recap` | Overview of progress | `/p:recap` |
| `/p:progress [period]` | Show progress metrics | `/p:progress week` |

### Context Commands
| Command | Purpose | Example |
|---------|---------|---------|
| `/p:init` | Initialize project | `/p:init` |
| `/p:stuck <issue>` | Get help with problem | `/p:stuck "CORS error"` |
| `/p:context` | Show project context | `/p:context` |

## Technical Implementation Details

### MCP Server Configuration
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem"],
      "config": {
        "rootPath": ".",
        "allowedPaths": [".prjct", "src", "app"]
      }
    },
    "context7": {
      "command": "npx",
      "args": ["@upstash/context7-mcp"],
      "description": "Library documentation lookup"
    }
  }
}
```

### Command Processing Flow
```
1. User types /p:command
2. Claude recognizes prjct command pattern
3. Executes via MCP filesystem operations
4. Updates relevant .prjct/ files
5. Returns formatted response with emoji
6. Suggests next action
```

### File Templates

#### now.md
```markdown
# NOW: [Current Task]
Started: [ISO Date]
Target: [Deadline/Goal]

## Current Task
[Task description]

## Blockers
[Any blockers or "None"]

## Notes
[Focus notes]
```

#### shipped.md
```markdown
# SHIPPED 🚀

## Week [N], [Year]
- ✅ **Feature name** _(timestamp)_
- ✅ **Another feature** _(timestamp)_

Total shipped: [count]
Velocity: [features/week]
```

## Performance Metrics

- **Setup time**: < 2 minutes
- **Command execution**: Instant
- **Context overhead**: < 1KB per project
- **Memory usage**: Minimal (text files only)
- **Learning curve**: 5 minutes

## Competitive Analysis

| Feature | prjct-cli | Jira | Linear | GitHub Projects |
|---------|-----------|------|--------|-----------------|
| Setup time | 2 min | Hours | 30 min | 15 min |
| Learning curve | 5 min | Days | Hours | Hour |
| Ceremonies | None | Heavy | Medium | Light |
| AI integrated | Native | No | No | No |
| Indie-focused | Yes | No | No | Partial |
| Cost | Free | $$$ | $$ | Free/$ |

## Success Metrics

### User Adoption
- Target: 1,000 indie hackers in 3 months
- Metric: Daily active commands
- Success: >5 ships per week per user

### Feature Velocity
- Before prjct: 1-2 features/week
- After prjct: 3-5 features/week
- Improvement: 150%+ shipping velocity

## Roadmap

### Phase 1: Core (Current)
- ✅ Basic commands
- ✅ MCP integration
- ✅ File-based storage
- ✅ Claude Code support

### Phase 2: Enhancement
- [ ] Git integration
- [ ] Changelog generation
- [ ] Progress analytics
- [ ] Multiple project support

### Phase 3: Expansion
- [ ] Team features (optional)
- [ ] API for external tools
- [ ] Mobile companion app
- [ ] Public shipping page

## Installation Requirements

### System Requirements
- Node.js 18+
- Claude Code / Cursor / Warp
- macOS or Linux
- 10MB disk space

### Dependencies
```json
{
  "mcp-servers": {
    "@modelcontextprotocol/server-filesystem": "latest",
    "@upstash/context7-mcp": "latest"
  }
}
```

## Security & Privacy

- **Data location**: Local only (.prjct/ folder)
- **No telemetry**: Zero data collection
- **No cloud**: Everything stays on your machine
- **Open source**: Full transparency

## Support & Documentation

- **GitHub**: github.com/yourusername/prjct-cli
- **Discord**: Community support
- **Twitter**: @prjctcli for updates
- **Email**: support@prjct.dev

## Conclusion

prjct-cli represents a paradigm shift in project management for solo developers. By eliminating ceremony and focusing on shipping, it enables developers to maintain momentum and visibility without the overhead of traditional tools.

**The only metric that matters: Features shipped.**

---

*Built for builders who ship, not managers who meet.*