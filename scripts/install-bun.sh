#!/bin/bash

# prjct-cli Bun Installation Script
# Usage: curl -fsSL https://prjct.app/install-bun.sh | bash

set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

# Unicode
CHECK="✓"
CROSS="✗"
ARROW="▸"

INSTALL_DIR="$HOME/.prjct-cli"

clear

echo ""
echo -e "   ${BOLD}${CYAN}██████╗ ██████╗      ██╗ ██████╗████████╗${NC}"
echo -e "   ${BOLD}${CYAN}██╔══██╗██╔══██╗     ██║██╔════╝╚══██╔══╝${NC}"
echo -e "   ${BOLD}${CYAN}██████╔╝██████╔╝     ██║██║        ██║${NC}"
echo -e "   ${BOLD}${CYAN}██╔═══╝ ██╔══██╗██   ██║██║        ██║${NC}"
echo -e "   ${BOLD}${CYAN}██║     ██║  ██║╚█████╔╝╚██████╗   ██║${NC}"
echo -e "   ${BOLD}${CYAN}╚═╝     ╚═╝  ╚═╝ ╚════╝  ╚═════╝   ╚═╝${NC}"
echo ""
echo -e "   ${BOLD}Bun Installation${NC} ${DIM}(⚡ Lightning fast)${NC}"
echo ""

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${YELLOW}${ARROW}${NC} Bun is not installed"
    echo ""
    read -p "Install Bun now? (Y/n): " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo -e "${CYAN}${ARROW}${NC} Installing Bun..."
        curl -fsSL https://bun.sh/install | bash

        # Source the Bun environment
        export BUN_INSTALL="$HOME/.bun"
        export PATH="$BUN_INSTALL/bin:$PATH"

        if ! command -v bun &> /dev/null; then
            echo -e "${RED}${CROSS}${NC} Bun installation failed"
            echo -e "Please install Bun manually: ${CYAN}https://bun.sh${NC}"
            exit 1
        fi
    else
        echo -e "${RED}${CROSS}${NC} Bun is required for this installation method"
        echo ""
        echo -e "Alternatives:"
        echo -e "  ${CYAN}curl -fsSL https://prjct.app/install.sh | bash${NC}  ${DIM}# Node.js${NC}"
        echo -e "  ${CYAN}brew install prjct${NC}                               ${DIM}# Homebrew${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}${CHECK}${NC} Bun found: $(bun --version)"
echo ""

# Check if Git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}${CROSS}${NC} Git is required but not installed"
    echo -e "Install from: ${CYAN}https://git-scm.com${NC}"
    exit 1
fi

# Clone or update repository
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${CYAN}${ARROW}${NC} Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull origin main --quiet
else
    echo -e "${CYAN}${ARROW}${NC} Cloning prjct-cli..."
    git clone https://github.com/jlopezlira/prjct-cli.git "$INSTALL_DIR" --quiet
    cd "$INSTALL_DIR"
fi

# Install dependencies with Bun
echo -e "${CYAN}${ARROW}${NC} Installing dependencies with Bun..."
bun install --production

# Run setup script
echo -e "${CYAN}${ARROW}${NC} Running setup..."
chmod +x scripts/setup.sh
./scripts/setup.sh > /tmp/prjct-setup.log 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}${CHECK}${NC} Setup complete"
else
    echo -e "${RED}${CROSS}${NC} Setup failed. Check /tmp/prjct-setup.log for details"
    exit 1
fi

# Install commands to AI editors
echo -e "${CYAN}${ARROW}${NC} Installing commands to AI editors..."
bun run "$INSTALL_DIR/bin/prjct" install --no-interactive 2>/dev/null || \
    echo -e "${DIM}Note: MCP setup will run on first project init${NC}"

# Configure PATH
SHELL_CONFIG=""
if [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
else
    SHELL_CONFIG="$HOME/.profile"
fi

if ! grep -q "prjct-cli/bin" "$SHELL_CONFIG" 2>/dev/null; then
    echo "" >> "$SHELL_CONFIG"
    echo "# prjct/cli" >> "$SHELL_CONFIG"
    echo "export PATH=\"\$HOME/.prjct-cli/bin:\$PATH\"" >> "$SHELL_CONFIG"
    echo -e "${GREEN}${CHECK}${NC} Added to PATH in $SHELL_CONFIG"
else
    echo -e "${GREEN}${CHECK}${NC} PATH already configured"
fi

# Create symlink
mkdir -p "$HOME/.local/bin"
ln -sf "$INSTALL_DIR/bin/prjct" "$HOME/.local/bin/prjct" 2>/dev/null

echo ""
echo -e "${GREEN}✅${NC} ${BOLD}Installation Complete!${NC} ${GREEN}🎉${NC}"
echo ""
echo -e "${BOLD}${CYAN}🚀 Quick Start${NC}"
echo ""
echo -e "  1. Reload your terminal:"
echo -e "     ${CYAN}source $SHELL_CONFIG${NC}"
echo ""
echo -e "  2. Initialize your project:"
echo -e "     ${CYAN}cd your-project && prjct init${NC}"
echo ""
echo -e "  3. Start shipping:"
echo -e "     ${CYAN}prjct now \"build awesome feature\"${NC}"
echo ""
echo -e "${BOLD}⚡ Running on Bun - Lightning fast! 🚀${NC}"
echo ""
