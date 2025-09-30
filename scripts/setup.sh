#!/bin/bash

# prjct/cli - Turn ideas into AI-ready roadmaps
# Ship faster with zero friction

set -e

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color
BOLD='\033[1m'
DIM='\033[2m'

# Unicode characters for better visuals
CHECK="✓"
CROSS="✗"
ARROW="▸"
DOT="•"

# Clear screen for clean install experience
clear

# Animated header
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}${WHITE}        🚀 prjct/${MAGENTA}cli${WHITE} installer         ${NC}${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${DIM}   Turn ideas into AI-ready roadmaps      ${NC}${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${YELLOW}⚡${NC} Ship faster with zero friction"
echo -e "  ${GREEN}📝${NC} From idea to technical tasks in minutes"
echo -e "  ${BLUE}🤖${NC} Perfect context for AI agents"
echo ""
echo -e "${DIM}────────────────────────────────────────────────${NC}"
echo ""

# Spinner function
spin() {
    local pid=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# Progress bar function
show_progress() {
    local current=$1
    local total=$2
    local width=40
    local percentage=$((current * 100 / total))
    local filled=$((current * width / total))

    printf "\r  "
    printf "${GREEN}"
    for ((i=0; i<filled; i++)); do printf "▓"; done
    printf "${DIM}"
    for ((i=filled; i<width; i++)); do printf "░"; done
    printf "${NC} ${percentage}%%"
}

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Step counter
STEP=1
TOTAL_STEPS=6

print_step() {
    echo -e "\n${BOLD}${CYAN}[$STEP/$TOTAL_STEPS]${NC} ${BOLD}$1${NC}"
    ((STEP++))
}

# Check prerequisites
print_step "Checking prerequisites"

# Check Node.js with spinner
printf "  ${ARROW} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e " ${RED}${CROSS}${NC}"
    echo -e "\n  ${RED}Node.js is required but not installed.${NC}"
    echo -e "  Please install Node.js 18+ from ${CYAN}https://nodejs.org${NC}"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e " ${RED}${CROSS}${NC}"
    echo -e "\n  ${RED}Node.js 18+ is required (found v$NODE_VERSION)${NC}"
    exit 1
fi
echo -e " ${GREEN}${CHECK}${NC} v$(node --version)"

# Install npm dependencies
print_step "Installing dependencies"
cd "$SCRIPT_DIR"

# Remove old node_modules if exists
if [ -d "node_modules" ]; then
    printf "  ${ARROW} Cleaning old dependencies..."
    rm -rf node_modules package-lock.json 2>/dev/null
    echo -e " ${GREEN}${CHECK}${NC}"
fi

# Install with progress indication
printf "  ${ARROW} Installing packages"
(
    npm install --silent > /dev/null 2>&1
) &
spin $!
echo -e " ${GREEN}${CHECK}${NC}"

# Show installed packages count
PKG_COUNT=$(ls -1 node_modules 2>/dev/null | wc -l | tr -d ' ')
echo -e "  ${DIM}${DOT} $PKG_COUNT packages installed${NC}"

# Create core files if needed
print_step "Setting up core files"

printf "  ${ARROW} Checking core structure..."
if [ ! -f "$SCRIPT_DIR/core/commands.js" ]; then
    mkdir -p "$SCRIPT_DIR/core"
    echo -e " ${YELLOW}creating${NC}"
else
    echo -e " ${GREEN}${CHECK}${NC}"
fi

# Create bin executable
print_step "Creating executable"

printf "  ${ARROW} Setting up prjct command..."
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
echo -e " ${GREEN}${CHECK}${NC}"

# Platform detection and installation
print_step "Detecting AI platforms"
PLATFORMS_INSTALLED=""
PLATFORM_COUNT=0

# 1. Check for Claude Code
printf "  ${ARROW} Claude Code..."
if [ -d "$HOME/.claude" ] || [ -f "$HOME/.claude/CLAUDE.md" ]; then
    echo -e " ${GREEN}found${NC}"

    # Install command files directly to ~/.claude/commands/
    if [ -d "$SCRIPT_DIR/commands" ]; then
        printf "    ${DIM}Installing commands...${NC}"

        # Create subdirectory for /p:* namespace
        mkdir -p "$HOME/.claude/commands/p"
        CMD_COUNT=0
        for cmd_file in "$SCRIPT_DIR/commands"/*.md; do
            if [ -f "$cmd_file" ]; then
                filename=$(basename "$cmd_file")
                # Copy to p/ subdirectory for /p:* namespace
                cp "$cmd_file" "$HOME/.claude/commands/p/${filename}"
                ((CMD_COUNT++))
            fi
        done
        echo -e " ${GREEN}${CHECK}${NC} ($CMD_COUNT commands)"
        ((PLATFORM_COUNT++))
        PLATFORMS_INSTALLED="$PLATFORMS_INSTALLED Claude"
    fi

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
        echo -e "${GREEN}✅ Claude Code instructions added to COMMANDS.md${NC}"
    else
        echo -e "${YELLOW}⚠️  Claude COMMANDS.md not found. Creating minimal instructions...${NC}"
        # Create minimal COMMANDS.md with prjct info
        mkdir -p "$HOME/.claude"
        cat > "$HOME/.claude/COMMANDS.md" << 'EOF'
# Claude Code Commands

## PRJCT Commands
Commands starting with /p: are handled by the prjct system.
Command files are located in ~/.claude/commands/p/
EOF
        cat "$SCRIPT_DIR/adapters/claude/PRJCT_COMMANDS.md" >> "$HOME/.claude/COMMANDS.md"
    fi

    echo -e "${GREEN}✅ Claude Code instructions added to COMMANDS.md${NC}"
    PLATFORMS_INSTALLED="$PLATFORMS_INSTALLED Claude"
else
    echo -e " ${DIM}not found${NC}"
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

# Optional: Setup Context7 MCP
print_step "Optional: Configure MCP Context7"

printf "  ${ARROW} Enable Context7 for documentation? (y/N): "
read -r ENABLE_CONTEXT7

if [[ "$ENABLE_CONTEXT7" =~ ^[Yy]$ ]]; then
    if [ -d "$HOME/.config/claude" ]; then
        printf "    ${DIM}Installing Context7 config...${NC}"

        # Check if claude_desktop_config.json exists
        if [ -f "$HOME/.config/claude/claude_desktop_config.json" ]; then
            # Backup existing config
            cp "$HOME/.config/claude/claude_desktop_config.json" "$HOME/.config/claude/claude_desktop_config.json.backup"
            echo -e " ${GREEN}${CHECK}${NC} (backed up existing)"
        else
            # Create empty config
            echo '{"mcpServers": {}}' > "$HOME/.config/claude/claude_desktop_config.json"
            echo -e " ${GREEN}${CHECK}${NC} (created new)"
        fi

        echo -e "${YELLOW}   📝 Add this to your Claude Desktop config:${NC}"
        echo -e "${DIM}      {\"mcpServers\": {\"context7\": {\"command\": \"npx\", \"args\": [\"-y\", \"@upstash/context7-mcp@latest\"]}}}${NC}"
    else
        echo -e " ${YELLOW}!${NC} Claude Desktop not found - manual setup required"
    fi
else
    echo -e " ${DIM}skipped${NC}"
fi

# Final step
print_step "Installation complete!"

# Show summary with animation
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${BOLD}${WHITE}✨ prjct/cli successfully installed! ✨${NC}         ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Platform summary
if [ $PLATFORM_COUNT -gt 0 ]; then
    echo -e "  ${GREEN}${CHECK}${NC} Detected platforms:"
    if [[ "$PLATFORMS_INSTALLED" == *"Claude"* ]]; then
        echo -e "    ${CYAN}●${NC} Claude Code ${DIM}(commands ready)${NC}"
    fi
    if [[ "$PLATFORMS_INSTALLED" == *"Cursor"* ]]; then
        echo -e "    ${MAGENTA}●${NC} Cursor/VS Code ${DIM}(extension created)${NC}"
    fi
    if [[ "$PLATFORMS_INSTALLED" == *"Warp"* ]]; then
        echo -e "    ${YELLOW}●${NC} Warp Terminal ${DIM}(autocomplete enabled)${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠${NC}  No AI platforms detected ${DIM}(manual setup required)${NC}"
fi

echo ""
echo -e "${BOLD}${CYAN}🚀 Quick Start${NC}"
echo -e "${DIM}─────────────────────────────────────────────────${NC}"
echo ""
echo -e "  ${BOLD}1.${NC} Initialize your project:"
echo -e "     ${DIM}Terminal:${NC}     ${GREEN}prjct init${NC}"
echo -e "     ${DIM}Claude Code:${NC}  ${GREEN}/sc:p:init${NC}"
echo ""
echo -e "  ${BOLD}2.${NC} Set your current focus:"
echo -e "     ${DIM}Terminal:${NC}     ${GREEN}prjct now \"build auth\"${NC}"
echo -e "     ${DIM}Claude Code:${NC}  ${GREEN}/sc:p:now \"build auth\"${NC}"
echo ""
echo -e "  ${BOLD}3.${NC} Ship & celebrate:"
echo -e "     ${DIM}Terminal:${NC}     ${GREEN}prjct ship \"user login\"${NC}"
echo -e "     ${DIM}Claude Code:${NC}  ${GREEN}/sc:p:ship \"user login\"${NC}"
echo ""
echo -e "${DIM}─────────────────────────────────────────────────${NC}"
echo ""
echo -e "  ${DIM}Documentation:${NC} ${CYAN}https://github.com/jlopezlira/prjct-cli${NC}"
echo -e "  ${DIM}Report issues:${NC} ${CYAN}https://github.com/jlopezlira/prjct-cli/issues${NC}"
echo ""
echo -e "${BOLD}${YELLOW}⚡ Ship faster with zero friction!${NC}"
echo ""