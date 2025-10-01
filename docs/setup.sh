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

# Get project root directory (parent of scripts/)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

# Step counter
STEP=1
TOTAL_STEPS=5

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

# Note: AI platform configuration is handled by install.sh
# This script only sets up core dependencies and structure
printf "  ${ARROW} AI editor commands will be configured by install.sh\n"
echo -e " ${GREEN}${CHECK}${NC}"

# Final step
print_step "Installation complete!"

# Show summary with animation
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${BOLD}${WHITE}✨ prjct/cli successfully installed! ✨${NC}         ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "  ${GREEN}${CHECK}${NC} Core setup complete"
echo -e "  ${DIM}AI editor commands configured by install.sh${NC}"

echo ""
echo -e "${BOLD}${CYAN}🚀 Quick Start${NC}"
echo -e "${DIM}─────────────────────────────────────────────────${NC}"
echo ""
echo -e "  ${BOLD}1.${NC} Initialize your project:"
echo -e "     ${DIM}Terminal:${NC}     ${GREEN}prjct init${NC}"
echo -e "     ${DIM}Claude Code:${NC}  ${GREEN}/p:init${NC}"
echo ""
echo -e "  ${BOLD}2.${NC} Set your current focus:"
echo -e "     ${DIM}Terminal:${NC}     ${GREEN}prjct now \"build auth\"${NC}"
echo -e "     ${DIM}Claude Code:${NC}  ${GREEN}/p:now \"build auth\"${NC}"
echo ""
echo -e "  ${BOLD}3.${NC} Ship & celebrate:"
echo -e "     ${DIM}Terminal:${NC}     ${GREEN}prjct ship \"user login\"${NC}"
echo -e "     ${DIM}Claude Code:${NC}  ${GREEN}/p:ship \"user login\"${NC}"
echo ""
echo -e "${DIM}─────────────────────────────────────────────────${NC}"
echo ""
echo -e "  ${DIM}Documentation:${NC} ${CYAN}https://github.com/jlopezlira/prjct-cli${NC}"
echo -e "  ${DIM}Report issues:${NC} ${CYAN}https://github.com/jlopezlira/prjct-cli/issues${NC}"
echo ""
echo -e "${BOLD}${YELLOW}⚡ Ship faster with zero friction!${NC}"
echo ""