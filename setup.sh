#!/bin/bash

# prjct-cli Universal Installer
# Compatible with Claude Code, Cursor, and Warp

# set -e  # Comentado para mejor manejo de errores

echo "🚀 Installing prjct-cli..."
echo ""
echo "Working directory: $(pwd)"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check Node.js installation
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    echo "Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required (found v$NODE_VERSION)"
    exit 1
fi

echo -e "${GREEN}✅ Node.js v$(node --version) detected${NC}"

# Install npm dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
cd "$SCRIPT_DIR"

# Remove old node_modules if exists
if [ -d "node_modules" ]; then
    echo "Cleaning old dependencies..."
    rm -rf node_modules package-lock.json
fi

# Install with visible output for debugging
npm install

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️ Error installing dependencies. Trying again...${NC}"
    npm install --force
fi

# Verify core/commands.js exists
if [ ! -f "$SCRIPT_DIR/core/commands.js" ]; then
    echo -e "${YELLOW}⚠️ core/commands.js not found!${NC}"
    echo "Creating core/commands.js..."
    mkdir -p "$SCRIPT_DIR/core"
    # Will be created separately if needed
fi

# Create bin executable
echo -e "${BLUE}🔧 Creating executable...${NC}"
mkdir -p bin
cat > bin/prjct << 'EOF'
#!/usr/bin/env node
const commands = require('../core/commands');
const args = process.argv.slice(2);

async function main() {
    const command = args[0];
    const params = args.slice(1).join(' ');

    let result;
    switch(command) {
        case 'init':
            result = await commands.init();
            break;
        case 'now':
            result = await commands.now(params || null);
            break;
        case 'done':
            result = await commands.done();
            break;
        case 'ship':
            result = await commands.ship(params);
            break;
        case 'next':
            result = await commands.next();
            break;
        case 'idea':
            result = await commands.idea(params);
            break;
        case 'recap':
            result = await commands.recap();
            break;
        case 'progress':
            result = await commands.progress(params || 'week');
            break;
        case 'stuck':
            result = await commands.stuck(params);
            break;
        case 'context':
            result = await commands.context();
            break;
        default:
            result = {
                success: false,
                message: `Unknown command: ${command}\n\nAvailable commands:\n  init, now, done, ship, next, idea, recap, progress, stuck, context`
            };
    }

    console.log(result.message);
    process.exit(result.success ? 0 : 1);
}

main().catch(console.error);
EOF

chmod +x bin/prjct

echo -e "${GREEN}✅ Executable created${NC}"

# Platform detection and installation
PLATFORMS_INSTALLED=""

# 1. Check for Claude Code
if [ -d "$HOME/.claude" ] || [ -f "$HOME/.claude/CLAUDE.md" ]; then
    echo -e "${BLUE}🤖 Configuring Claude Code...${NC}"

    # Create instructions file
    mkdir -p "$SCRIPT_DIR/adapters/claude"
    cat > "$SCRIPT_DIR/adapters/claude/PRJCT_COMMANDS.md" << 'EOF'

# PRJCT Commands for Claude Code

When you see /p:* commands, execute these actions using filesystem operations:

## Command Implementations

### /p:init
Create .prjct/ directory structure with initial files (now.md, next.md, shipped.md, ideas.md, memory.jsonl)

### /p:now [task]
- Without task: Read and display current task from .prjct/now.md
- With task: Update .prjct/now.md with new task and timestamp

### /p:done
Mark current task complete, clear now.md, suggest next task from queue

### /p:ship <feature>
Add feature to .prjct/shipped.md with celebration message and update weekly count

### /p:next
Display prioritized task queue from .prjct/next.md

### /p:idea <text>
Capture idea to .prjct/ideas.md, optionally add to next queue if actionable

### /p:recap
Show project overview: current task, shipped features, queued tasks, ideas

### /p:progress [period]
Display progress metrics for specified period (day/week/month)

### /p:stuck <issue>
Provide contextual help based on the issue description

### /p:context
Show project context and recent actions from memory.jsonl

## Response Format
Always respond with emoji-enhanced messages and suggest next actions to maintain momentum.
EOF

    # Append to Claude's COMMANDS.md if it exists
    if [ -f "$HOME/.claude/COMMANDS.md" ]; then
        echo "" >> "$HOME/.claude/COMMANDS.md"
        cat "$SCRIPT_DIR/adapters/claude/PRJCT_COMMANDS.md" >> "$HOME/.claude/COMMANDS.md"
        echo -e "${GREEN}✅ Claude Code configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Claude COMMANDS.md not found. Please add instructions manually from:${NC}"
        echo "   $SCRIPT_DIR/adapters/claude/PRJCT_COMMANDS.md"
    fi

    PLATFORMS_INSTALLED="$PLATFORMS_INSTALLED Claude"
fi

# 2. Check for VS Code / Cursor
if command -v code &> /dev/null || command -v cursor &> /dev/null; then
    echo -e "${BLUE}📝 Configuring Cursor/VS Code...${NC}"

    # Create extension structure
    mkdir -p "$SCRIPT_DIR/adapters/cursor"

    # Create package.json for extension
    cat > "$SCRIPT_DIR/adapters/cursor/package.json" << 'EOF'
{
  "name": "prjct",
  "displayName": "PRJCT - Project Management for Indies",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.74.0"
  },
  "main": "./extension.js",
  "contributes": {
    "commands": [
      {
        "command": "prjct.init",
        "title": "PRJCT: Initialize Project"
      },
      {
        "command": "prjct.now",
        "title": "PRJCT: Set Current Task"
      },
      {
        "command": "prjct.done",
        "title": "PRJCT: Complete Task"
      },
      {
        "command": "prjct.ship",
        "title": "PRJCT: Ship Feature"
      },
      {
        "command": "prjct.recap",
        "title": "PRJCT: Show Recap"
      }
    ]
  },
  "activationEvents": [
    "onCommand:prjct.init",
    "onCommand:prjct.now",
    "onCommand:prjct.done",
    "onCommand:prjct.ship",
    "onCommand:prjct.recap"
  ]
}
EOF

    # Create extension.js
    cat > "$SCRIPT_DIR/adapters/cursor/extension.js" << 'EOF'
const vscode = require('vscode');
const commands = require('../../core/commands');

function activate(context) {
    // Register all commands
    const commandMap = {
        'prjct.init': async () => {
            const result = await commands.init(vscode.workspace.rootPath);
            vscode.window.showInformationMessage(result.message);
        },
        'prjct.now': async () => {
            const task = await vscode.window.showInputBox({
                prompt: 'What are you working on?',
                placeHolder: 'implement authentication'
            });
            if (task) {
                const result = await commands.now(task, vscode.workspace.rootPath);
                vscode.window.showInformationMessage(result.message);
            }
        },
        'prjct.done': async () => {
            const result = await commands.done(vscode.workspace.rootPath);
            vscode.window.showInformationMessage(result.message);
        },
        'prjct.ship': async () => {
            const feature = await vscode.window.showInputBox({
                prompt: 'What feature are you shipping?',
                placeHolder: 'user authentication'
            });
            if (feature) {
                const result = await commands.ship(feature, vscode.workspace.rootPath);
                vscode.window.showInformationMessage(result.message);
            }
        },
        'prjct.recap': async () => {
            const result = await commands.recap(vscode.workspace.rootPath);
            const panel = vscode.window.createWebviewPanel(
                'prjctRecap',
                'PRJCT Recap',
                vscode.ViewColumn.One,
                {}
            );
            panel.webview.html = `<pre>${result.message}</pre>`;
        }
    };

    for (const [command, handler] of Object.entries(commandMap)) {
        context.subscriptions.push(
            vscode.commands.registerCommand(command, handler)
        );
    }
}

function deactivate() {}

module.exports = { activate, deactivate };
EOF

    echo -e "${GREEN}✅ VS Code/Cursor extension created${NC}"
    echo -e "${YELLOW}   Install in VS Code: Open the extension folder and press F5${NC}"

    PLATFORMS_INSTALLED="$PLATFORMS_INSTALLED Cursor"
fi

# 3. Check for Warp
if [[ "$TERM_PROGRAM" == "WarpTerminal" ]] || command -v warp &> /dev/null; then
    echo -e "${BLUE}⚡ Configuring Warp Terminal...${NC}"

    mkdir -p "$SCRIPT_DIR/adapters/warp"

    # Create Warp shell function
    cat > "$SCRIPT_DIR/adapters/warp/prjct.sh" << 'EOF'
#!/bin/bash

# PRJCT CLI for Warp Terminal
prjct() {
    local PRJCT_DIR=".prjct"
    local CMD="$1"
    shift

    case "$CMD" in
        init)
            mkdir -p "$PRJCT_DIR"
            echo "# NOW" > "$PRJCT_DIR/now.md"
            echo "# NEXT" > "$PRJCT_DIR/next.md"
            echo "# SHIPPED 🚀" > "$PRJCT_DIR/shipped.md"
            echo "# IDEAS 💡" > "$PRJCT_DIR/ideas.md"
            touch "$PRJCT_DIR/memory.jsonl"
            echo "🚀 Project initialized!"
            ;;

        now)
            if [ -z "$*" ]; then
                cat "$PRJCT_DIR/now.md" 2>/dev/null || echo "No current task"
            else
                echo "# NOW: $*" > "$PRJCT_DIR/now.md"
                echo "Started: $(date -Iseconds)" >> "$PRJCT_DIR/now.md"
                echo "📍 Focus set: $*"
            fi
            ;;

        done)
            TASK=$(head -n 1 "$PRJCT_DIR/now.md" | sed 's/# NOW: //')
            echo "# NOW" > "$PRJCT_DIR/now.md"
            echo "✅ Task complete: $TASK"
            ;;

        ship)
            if [ -z "$*" ]; then
                echo "⚠️  Specify feature: prjct ship \"feature name\""
            else
                echo "- ✅ **$*** _($(date))_" >> "$PRJCT_DIR/shipped.md"
                COUNT=$(grep -c "✅" "$PRJCT_DIR/shipped.md")
                echo "🚀 SHIPPED! Feature #$COUNT 🎉"
            fi
            ;;

        recap)
            echo "📊 Project Recap"
            echo ""
            echo -n "🎯 Current: "
            head -n 1 "$PRJCT_DIR/now.md" | sed 's/# NOW: //'
            echo -n "📦 Shipped: "
            grep -c "✅" "$PRJCT_DIR/shipped.md" 2>/dev/null || echo "0"
            echo -n "📝 Queued: "
            grep -c "^- " "$PRJCT_DIR/next.md" 2>/dev/null || echo "0"
            ;;

        *)
            echo "PRJCT - Project management for indie hackers"
            echo ""
            echo "Commands:"
            echo "  prjct init          Initialize project"
            echo "  prjct now [task]    Set/show current task"
            echo "  prjct done          Complete current task"
            echo "  prjct ship <name>   Ship a feature"
            echo "  prjct recap         Show project recap"
            ;;
    esac
}

# Add autocomplete
_prjct_completions() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local commands="init now done ship recap next idea progress stuck context"

    if [ $COMP_CWORD -eq 1 ]; then
        COMPREPLY=($(compgen -W "$commands" -- "$cur"))
    fi
}

complete -F _prjct_completions prjct
EOF

    # Add to shell profile
    SHELL_RC="$HOME/.zshrc"
    if [ -f "$HOME/.bashrc" ]; then
        SHELL_RC="$HOME/.bashrc"
    fi

    # Source the script in shell profile
    if ! grep -q "prjct.sh" "$SHELL_RC" 2>/dev/null; then
        echo "" >> "$SHELL_RC"
        echo "# PRJCT CLI" >> "$SHELL_RC"
        echo "source $SCRIPT_DIR/adapters/warp/prjct.sh" >> "$SHELL_RC"
        echo -e "${GREEN}✅ Warp configured (restart terminal or run: source $SHELL_RC)${NC}"
    else
        echo -e "${GREEN}✅ Warp already configured${NC}"
    fi

    PLATFORMS_INSTALLED="$PLATFORMS_INSTALLED Warp"
fi

# 4. Create global symlink for CLI
echo -e "${BLUE}🔗 Creating global command...${NC}"
INSTALL_DIR="/usr/local/bin"

if [ -w "$INSTALL_DIR" ]; then
    ln -sf "$SCRIPT_DIR/bin/prjct" "$INSTALL_DIR/prjct"
    echo -e "${GREEN}✅ Global 'prjct' command installed${NC}"
else
    echo -e "${YELLOW}⚠️  Cannot install globally. To use prjct command, add to PATH:${NC}"
    echo "   export PATH=\"$SCRIPT_DIR/bin:\$PATH\""
fi

# Summary
echo ""
echo "════════════════════════════════════════════════════"
echo -e "${GREEN}✨ prjct-cli installation complete!${NC}"
echo ""

if [ -n "$PLATFORMS_INSTALLED" ]; then
    echo "Platforms configured:$PLATFORMS_INSTALLED"
else
    echo -e "${YELLOW}No supported platforms detected${NC}"
fi

echo ""
echo "📚 Quick Start:"
echo ""
echo "  1. Initialize your project:"
echo "     prjct init          (Terminal)"
echo "     /p:init            (Claude Code)"
echo "     Cmd+Shift+P → PRJCT: Initialize  (Cursor)"
echo ""
echo "  2. Set your current task:"
echo "     prjct now \"implement auth\""
echo "     /p:now \"implement auth\""
echo ""
echo "  3. Ship features:"
echo "     prjct ship \"authentication\""
echo "     /p:ship \"authentication\""
echo ""
echo "════════════════════════════════════════════════════"
echo ""
echo "Need help? Check docs/ folder or visit prjct.dev"