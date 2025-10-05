#!/bin/bash

# prjct/cli - Update Script
# Quick update for installed instances

set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

# Get installation directory
INSTALL_DIR="$HOME/.prjct-cli"

# Check if installed
if [ ! -d "$INSTALL_DIR" ]; then
    echo ""
    echo "❌ prjct-cli not installed"
    echo ""
    echo "Install it first:"
    echo "  curl -fsSL https://prjct.app/install.sh | bash"
    echo ""
    exit 1
fi

cd "$INSTALL_DIR"

echo ""
echo -e "${BOLD}${CYAN}🔄 Updating prjct-cli...${NC}"
echo ""

# Update from git
printf "  ▸ Fetching latest version..."
git pull origin main --quiet > /dev/null 2>&1
echo -e " ${GREEN}✓${NC}"

# Install dependencies
printf "  ▸ Installing dependencies..."
npm install --silent > /dev/null 2>&1
echo -e " ${GREEN}✓${NC}"

# Update commands
printf "  ▸ Updating commands..."
node -e "
  const installer = require('./core/infrastructure/command-installer');
  installer.updateCommands().then(result => {
    if (result.success) {
      process.exit(0);
    } else {
      console.error('Update failed:', result.error);
      process.exit(1);
    }
  }).catch(err => {
    console.error('Update failed:', err.message);
    process.exit(1);
  });
" 2>&1 | grep -v "^🔄\|^✅"
echo -e " ${GREEN}✓${NC}"

# Get current version
VERSION=$(grep -o '"version":[[:space:]]*"[^"]*"' package.json | head -1 | cut -d'"' -f4)

echo ""
echo -e "${GREEN}✨ prjct-cli updated to v${VERSION}!${NC}"
echo ""
