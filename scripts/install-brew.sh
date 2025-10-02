#!/bin/bash

# prjct-cli Homebrew Installation Script
# Usage: curl -fsSL https://prjct.dev/install-brew.sh | bash

set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

# Unicode
CHECK="✓"
CROSS="✗"
ARROW="▸"

clear

echo ""
echo -e "   ${BOLD}${CYAN}██████╗ ██████╗      ██╗ ██████╗████████╗${NC}"
echo -e "   ${BOLD}${CYAN}██╔══██╗██╔══██╗     ██║██╔════╝╚══██╔══╝${NC}"
echo -e "   ${BOLD}${CYAN}██████╔╝██████╔╝     ██║██║        ██║${NC}"
echo -e "   ${BOLD}${CYAN}██╔═══╝ ██╔══██╗██   ██║██║        ██║${NC}"
echo -e "   ${BOLD}${CYAN}██║     ██║  ██║╚█████╔╝╚██████╗   ██║${NC}"
echo -e "   ${BOLD}${CYAN}╚═╝     ╚═╝  ╚═╝ ╚════╝  ╚═════╝   ╚═╝${NC}"
echo ""
echo -e "   ${BOLD}Homebrew Installation${NC}"
echo ""

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo -e "${RED}${CROSS} Homebrew is not installed${NC}"
    echo ""
    echo -e "Please install Homebrew first:"
    echo -e "${CYAN}/bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"${NC}"
    echo ""
    exit 1
fi

echo -e "${GREEN}${CHECK}${NC} Homebrew found: $(brew --version | head -1)"
echo ""

# Check if prjct is already installed
if brew list prjct &> /dev/null; then
    echo -e "${YELLOW}${ARROW}${NC} prjct is already installed"
    echo ""
    read -p "Do you want to upgrade? (y/N): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${CYAN}${ARROW}${NC} Upgrading prjct..."
        brew upgrade prjct
    else
        echo -e "${GREEN}${CHECK}${NC} Installation cancelled"
        exit 0
    fi
else
    # Add tap if not already added
    echo -e "${CYAN}${ARROW}${NC} Adding prjct tap..."
    brew tap jlopezlira/prjct

    # Install prjct
    echo -e "${CYAN}${ARROW}${NC} Installing prjct..."
    brew install prjct
fi

echo ""
echo -e "${GREEN}${CHECK}${NC} Installation complete!"
echo ""

# Run post-install setup
echo -e "${CYAN}${ARROW}${NC} Running post-installation setup..."
if command -v prjct &> /dev/null; then
    prjct install --no-interactive 2>/dev/null || echo -e "${YELLOW}Note: MCP setup will run on first project init${NC}"
fi

echo ""
echo -e "${BOLD}${GREEN}🚀 Quick Start${NC}"
echo ""
echo -e "  1. Initialize your project:"
echo -e "     ${CYAN}cd your-project && prjct init${NC}"
echo ""
echo -e "  2. Set your current task:"
echo -e "     ${CYAN}prjct now \"build awesome feature\"${NC}"
echo ""
echo -e "  3. Ship when done:"
echo -e "     ${CYAN}prjct ship \"awesome feature\"${NC}"
echo ""
echo -e "${BOLD}Happy shipping! 🎉${NC}"
echo ""
