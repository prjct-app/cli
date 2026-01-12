---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
description: 'Configure prjct statusline for Claude Code'
---

# p. setup-statusline - Configure Claude Code Status Line

## What This Does

Configures Claude Code to display a rich status line showing:
- **prjct task** - Current task you're working on
- **Git branch** - With dirty indicator (*)
- **Lines changed** - Session productivity
- **Context usage** - Visual bar with percentage
- **Model** - Which Claude model is active

## Available Themes

| Theme | Description |
|-------|-------------|
| `default` | prjct brand colors (cyan/purple) |
| `gentleman` | Elegant blues and golds |
| `minimal` | Clean grayscale |

---

## Flow

```
1. Check if statusline script exists
2. Ask user for theme preference
3. Create/update ~/.claude/settings.json
4. Verify installation
5. Show next steps
```

---

## Step 1: Verify Installation

```bash
# Check statusline exists
ls -la ~/.prjct-cli/statusline/statusline.sh
ls ~/.prjct-cli/statusline/themes/
```

IF script missing:
```
❌ Statusline not installed. Please reinstall prjct-cli.
```
→ STOP

---

## Step 2: Theme Selection

```
AskUserQuestion:
  header: "Theme"
  question: "Which theme would you like for your status line?"
  options:
    - label: "prjct (Recommended)"
      description: "Cyan and purple - matches prjct branding"
    - label: "Gentleman"
      description: "Elegant blues and golds"
    - label: "Minimal"
      description: "Clean grayscale with accents"
```

Map selection:
- "prjct" → `default.json`
- "Gentleman" → `gentleman.json`
- "Minimal" → `minimal.json`

---

## Step 3: Configure Claude Code Settings

READ: `~/.claude/settings.json` (may not exist)

MERGE with:
```json
{
  "statusLine": {
    "command": "~/.prjct-cli/statusline/statusline.sh"
  }
}
```

If theme != default, also set environment:
```json
{
  "env": {
    "PRJCT_STATUSLINE_THEME": "~/.prjct-cli/statusline/themes/{theme}.json"
  }
}
```

WRITE: `~/.claude/settings.json`

---

## Step 4: Verify

```bash
# Test the script with mock data
echo '{"model":{"display_name":"Claude Sonnet"},"workspace":{"current_dir":"'$(pwd)'"},"cost":{"total_lines_added":42,"total_lines_removed":15},"context_window":{"context_window_size":200000,"current_usage":{"input_tokens":50000}}}' | ~/.prjct-cli/statusline/statusline.sh
```

---

## Output

```
✅ Statusline configured!

Theme: {selected theme}
Config: ~/.claude/settings.json

Restart Claude Code to see your new status line.

Features:
• ⚡ prjct task indicator
•  Git branch with dirty state
• +/- Lines changed this session
• Context usage bar (green/yellow/red)
• Model icon (🎭 Opus, 📝 Sonnet, 🍃 Haiku)
```

---

## Troubleshooting

IF statusline not showing:
1. Verify `jq` is installed: `which jq`
2. Check script is executable: `ls -la ~/.prjct-cli/statusline/statusline.sh`
3. Test manually with mock data (see Step 4)
4. Check Claude Code logs for errors
