# Claude Code UX Enhancements

prjct provides rich terminal UX improvements for Claude Code while staying 100% compatible with Anthropic's Terms of Service.

## Quick Setup

```bash
# Run the setup command
p. setup-statusline
```

Or manually configure:

```json
// ~/.claude/settings.json
{
  "statusLine": {
    "command": "~/.prjct-cli/statusline/statusline.sh"
  }
}
```

---

## Features

### 1. Status Line

Displays real-time information in Claude Code's status area:

```
⚡ Current Task │ 󰉋 directory │  branch* │ +42 -15 │ ctx [████░░░░░░] 40% │ 🎭
```

| Segment | Description |
|---------|-------------|
| ⚡ Task | Current prjct task (from state.json) |
| 󰉋 Dir | Current working directory |
|  Branch | Git branch with dirty indicator (*) |
| +/- | Lines added/removed this session |
| ctx Bar | Context window usage (color-coded) |
| Icon | Model: 🎭 Opus, 📝 Sonnet, 🍃 Haiku |

**Context Bar Colors:**
- 🟢 Green: < 50% usage
- 🟡 Yellow: 50-80% usage
- 🔴 Red: > 80% usage (warning!)

### 2. Themes

Three built-in themes at `~/.prjct-cli/statusline/themes/`:

| Theme | File | Description |
|-------|------|-------------|
| **prjct** | `default.json` | Cyan and purple - matches prjct branding |
| **Gentleman** | `gentleman.json` | Elegant blues and golds (inspired by GentlemanClaude) |
| **Minimal** | `minimal.json` | Clean grayscale with accent colors |

**Switch themes:**
```json
{
  "env": {
    "PRJCT_STATUSLINE_THEME": "~/.prjct-cli/statusline/themes/gentleman.json"
  }
}
```

### 3. Output Styles

Custom output formatting at `~/.prjct-cli/output-styles/`:

| Style | Use Case |
|-------|----------|
| `prjct.md` | Default - concise, actionable |
| `verbose.md` | Learning - detailed explanations |
| `ship-fast.md` | Maximum velocity - minimal output |

**Activate:**
```
/output-style ~/.prjct-cli/output-styles/prjct.md
```

### 4. Hooks

Automatic metrics tracking:

| Hook | Event | Purpose |
|------|-------|---------|
| `update-metrics.sh` | PostToolUse | Tracks file changes and commands |
| `session-summary.sh` | Stop | Shows session statistics |

**Enable hooks:**
```json
{
  "hooks": [
    {
      "event": "PostToolUse",
      "command": "~/.prjct-cli/hooks/update-metrics.sh",
      "matcher": { "tool": "Write" }
    },
    {
      "event": "Stop",
      "command": "~/.prjct-cli/hooks/session-summary.sh"
    }
  ]
}
```

### 5. Visual Theme (tweakcc)

Full Claude Code visual theme at `~/.prjct-cli/tweakcc-theme.json`:

- Custom color palette
- Spanish thinking verbs
- Diff highlighting
- Shimmer effects

---

## File Locations

```
~/.prjct-cli/
├── statusline/
│   ├── statusline.sh          # Main script
│   └── themes/
│       ├── default.json       # prjct theme
│       ├── gentleman.json     # Elegant theme
│       └── minimal.json       # Clean theme
├── hooks/
│   ├── update-metrics.sh      # Track tool usage
│   └── session-summary.sh     # Session stats
├── output-styles/
│   ├── prjct.md               # Concise output
│   ├── verbose.md             # Detailed output
│   └── ship-fast.md           # Minimal output
├── tweakcc-theme.json         # Visual theme
└── settings.template.json     # Full config template
```

---

## ToS Compliance

All features use **officially documented** Claude Code APIs:

| Feature | API Used | Documentation |
|---------|----------|---------------|
| Status Line | `statusLine.command` | code.claude.com/docs/en/statusline |
| Hooks | `hooks` array | code.claude.com/docs/en/hooks-guide |
| Output Styles | Custom markdown | code.claude.com/docs/en/output-styles |
| Themes | Environment vars | code.claude.com/docs/en/settings |

**What we DON'T do:**
- ❌ Modify Claude Code internals
- ❌ Bypass rate limits
- ❌ Reverse engineer protocols
- ❌ Access unauthorized data

---

## Troubleshooting

### Status line not showing

1. Check `jq` is installed: `which jq`
2. Verify script is executable: `ls -la ~/.prjct-cli/statusline/statusline.sh`
3. Test manually:
   ```bash
   echo '{"model":{"display_name":"Claude Sonnet"}}' | ~/.prjct-cli/statusline/statusline.sh
   ```

### Theme not loading

1. Check file exists: `ls ~/.prjct-cli/statusline/themes/`
2. Verify JSON is valid: `jq . ~/.prjct-cli/statusline/themes/default.json`
3. Check env var is set in settings.json

### Hooks not firing

1. Verify hook scripts are executable
2. Check Claude Code logs for errors
3. Test hook manually:
   ```bash
   echo '{"tool":"Write"}' | ~/.prjct-cli/hooks/update-metrics.sh
   ```

---

## Customization

### Create Custom Theme

```json
// ~/.prjct-cli/statusline/themes/my-theme.json
{
  "name": "My Theme",
  "colors": {
    "primary": "39",      // ANSI 256 color code
    "accent": "208",
    "success": "82",
    "error": "196"
  },
  "icons": {
    "brand": "🚀",
    "branch": ""
  }
}
```

### Create Custom Output Style

```markdown
<!-- ~/.prjct-cli/output-styles/my-style.md -->
---
name: My Style
description: Custom output formatting
keep-coding-instructions: true
---

# My Custom Instructions

[Your formatting rules here]
```

---

## Credits

Inspired by [GentlemanClaude](https://github.com/Gentleman-Programming/Gentleman.Dots/tree/main/GentlemanClaude) by Gentleman Programming.

**prjct-cli** | https://prjct.app
