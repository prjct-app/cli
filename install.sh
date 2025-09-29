#!/bin/bash

# prjct/cli - Turn ideas into AI-ready roadmaps
# Usage: curl -fsSL https://prjct.app/install.sh | bash

set -e

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

# Unicode characters
CHECK="✓"
CROSS="✗"
ARROW="▸"
DOT="•"

# Clear for clean experience
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

# Step counter
STEP=1
TOTAL_STEPS=5

print_step() {
    echo -e "\n${BOLD}${CYAN}[$STEP/$TOTAL_STEPS]${NC} ${BOLD}$1${NC}"
    ((STEP++))
}

# Installation directory
INSTALL_DIR="$HOME/.prjct-cli"

# Check prerequisites
print_step "Checking prerequisites"

# Check Node.js
printf "  ${ARROW} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e " ${RED}${CROSS}${NC}"
    echo -e "\n  ${RED}Node.js is required but not installed.${NC}"
    echo -e "  Install from: ${CYAN}https://nodejs.org${NC}"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e " ${RED}${CROSS}${NC}"
    echo -e "\n  ${RED}Node.js 18+ is required (found v$NODE_VERSION)${NC}"
    exit 1
fi
echo -e " ${GREEN}${CHECK}${NC} $(node --version)"

# Check Git
printf "  ${ARROW} Checking Git..."
if ! command -v git &> /dev/null; then
    echo -e " ${RED}${CROSS}${NC}"
    echo -e "\n  ${RED}Git is required but not installed.${NC}"
    echo -e "  Install from: ${CYAN}https://git-scm.com${NC}"
    exit 1
fi
echo -e " ${GREEN}${CHECK}${NC} $(git --version | cut -d' ' -f3)"

# Clone or update repository
print_step "Downloading prjct/cli"

if [ -d "$INSTALL_DIR" ]; then
    printf "  ${ARROW} Updating existing installation"
    cd "$INSTALL_DIR"
    (
        git pull origin main --quiet > /dev/null 2>&1
    ) &
    spin $!
    echo -e " ${GREEN}${CHECK}${NC}"
else
    printf "  ${ARROW} Cloning repository"
    (
        git clone https://github.com/jlopezlira/prjct-cli.git "$INSTALL_DIR" --quiet > /dev/null 2>&1
    ) &
    spin $!
    echo -e " ${GREEN}${CHECK}${NC}"
    cd "$INSTALL_DIR"
fi

# Run setup script
print_step "Running setup"

printf "  ${ARROW} Installing components"
chmod +x setup.sh
(
    ./setup.sh > /tmp/prjct-setup.log 2>&1
) &
spin $!

if [ $? -eq 0 ]; then
    echo -e " ${GREEN}${CHECK}${NC}"
else
    echo -e " ${RED}${CROSS}${NC}"
    echo -e "\n  ${RED}Setup failed. Check /tmp/prjct-setup.log for details${NC}"
    exit 1
fi

# Install Claude Code commands
print_step "Configuring AI platforms"

# Claude Code detection
printf "  ${ARROW} Claude Code..."
if [ -d "$HOME/.claude" ]; then
    # Copy command files to p/ subdirectory for /p: namespace
    if [ -d "$INSTALL_DIR/commands" ]; then
        # Create subdirectory for /p:* namespace
        mkdir -p "$HOME/.claude/commands/p"
        CMD_COUNT=0
        for cmd_file in "$INSTALL_DIR/commands"/*.md; do
            if [ -f "$cmd_file" ]; then
                filename=$(basename "$cmd_file")
                # Copy to p/ subdirectory for /p:* namespace
                cp "$cmd_file" "$HOME/.claude/commands/p/${filename}"
                ((CMD_COUNT++)
            fi
        done
        echo -e " ${GREEN}${CHECK}${NC} ($CMD_COUNT commands)"
    else
        echo -e " ${YELLOW}!${NC} (commands not found)"
    fi
else
    echo -e " ${DIM}not found${NC}"
fi

# Configure PATH
print_step "Setting up environment"

# Detect shell
printf "  ${ARROW} Configuring shell..."
if [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
    SHELL_NAME="zsh"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
    SHELL_NAME="bash"
else
    SHELL_CONFIG="$HOME/.profile"
    SHELL_NAME="sh"
fi

# Add to PATH
if ! grep -q "prjct-cli/bin" "$SHELL_CONFIG" 2>/dev/null; then
    echo "" >> "$SHELL_CONFIG"
    echo "# prjct/cli" >> "$SHELL_CONFIG"
    echo "export PATH=\"\$HOME/.prjct-cli/bin:\$PATH\"" >> "$SHELL_CONFIG"
    echo -e " ${GREEN}${CHECK}${NC} ($SHELL_NAME)"
else
    echo -e " ${GREEN}${CHECK}${NC} (already configured)"
fi

# Create symlink
mkdir -p "$HOME/.local/bin"
ln -sf "$INSTALL_DIR/bin/prjct" "$HOME/.local/bin/prjct" 2>/dev/null || true

# Success message with animation
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${BOLD}${WHITE}🎉 prjct/cli installed successfully! 🎉${NC}         ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Quick start guide
echo -e "${BOLD}${CYAN}🚀 Quick Start${NC}"
echo -e "${DIM}─────────────────────────────────────────────────${NC}"
echo ""

# Show commands based on detected platforms
if [ -d "$HOME/.claude" ]; then
    echo -e "  ${BOLD}Claude Code Commands:${NC}"
    echo -e "    ${GREEN}/p-init${NC}     ${DIM}Initialize project${NC}"
    echo -e "    ${GREEN}/p-now${NC}      ${DIM}Set current task${NC}"
    echo -e "    ${GREEN}/p-ship${NC}     ${DIM}Ship & celebrate${NC}"
    echo ""
fi

echo -e "  ${BOLD}Terminal Commands:${NC}"
echo -e "    ${GREEN}prjct init${NC}     ${DIM}Initialize project${NC}"
echo -e "    ${GREEN}prjct now${NC}      ${DIM}Set current task${NC}"
echo -e "    ${GREEN}prjct ship${NC}     ${DIM}Ship & celebrate${NC}"

echo ""
echo -e "${DIM}─────────────────────────────────────────────────${NC}"
echo ""

# Next steps
echo -e "${BOLD}${YELLOW}⚡ Next Steps${NC}"
echo ""
echo -e "  1. ${DIM}Reload your terminal:${NC}"
echo -e "     ${CYAN}source $SHELL_CONFIG${NC}"
echo ""
echo -e "  2. ${DIM}Initialize your project:${NC}"
echo -e "     ${CYAN}cd your-project && prjct init${NC}"
echo ""
echo -e "  3. ${DIM}Start shipping:${NC}"
echo -e "     ${CYAN}prjct now \"build awesome feature\"${NC}"
echo ""
echo -e "${DIM}─────────────────────────────────────────────────${NC}"
echo ""
echo -e "  ${DIM}Documentation:${NC} ${CYAN}https://github.com/jlopezlira/prjct-cli${NC}"
echo -e "  ${DIM}Report issues:${NC} ${CYAN}https://github.com/jlopezlira/prjct-cli/issues${NC}"
echo ""
echo -e "${BOLD}${MAGENTA}Happy shipping! 🚀${NC}"
echo ""