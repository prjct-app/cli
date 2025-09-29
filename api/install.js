// API endpoint to serve the install script
// Serves the installation script for curl installation

export default function handler(req, res) {
  // Set appropriate headers for shell script
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  // Installation script
  const installScript = `#!/bin/bash

# prjct-cli installer
# Private tool - not open source
# Install via: curl -fsSL https://prjct-cli.vercel.app/install.sh | bash

set -e

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Configuration
INSTALL_DIR="\\$HOME/.prjct-cli"
BIN_DIR="/usr/local/bin"
API_URL="https://prjct-cli.vercel.app/api"

echo -e "\\${BLUE}╔══════════════════════════════════════╗\\${NC}"
echo -e "\\${BLUE}║       Installing prjct-cli 🚀        ║\\${NC}"
echo -e "\\${BLUE}╚══════════════════════════════════════╝\\${NC}"
echo ""

# Check for required tools
check_requirements() {
    local missing=()

    if ! command -v node &> /dev/null; then
        missing+=("Node.js")
    fi

    if ! command -v npm &> /dev/null; then
        missing+=("npm")
    fi

    if [ \\${#missing[@]} -ne 0 ]; then
        echo -e "\\${RED}Error: Missing required dependencies:\\${NC}"
        for dep in "\\${missing[@]}"; do
            echo -e "  \\${RED}✗\\${NC} \\$dep"
        done
        echo ""
        echo "Please install Node.js first: https://nodejs.org"
        exit 1
    fi
}

# Clean previous installation if exists
if [ -d "\\$INSTALL_DIR" ]; then
    echo -e "\\${YELLOW}Found existing installation. Updating...\\${NC}"
    rm -rf "\\$INSTALL_DIR.backup"
    mv "\\$INSTALL_DIR" "\\$INSTALL_DIR.backup"
fi

echo "📋 Checking requirements..."
check_requirements

# Create installation directory
echo "📁 Creating installation directory..."
mkdir -p "\\$INSTALL_DIR"

# Download package from Vercel
echo "📦 Downloading prjct-cli package..."
TEMP_FILE=\\$(mktemp)
if ! curl -fsSL "\\$API_URL/download" -o "\\$TEMP_FILE"; then
    echo -e "\\${RED}Failed to download package\\${NC}"
    exit 1
fi

# Extract package
echo "📂 Extracting files..."
tar -xzf "\\$TEMP_FILE" -C "\\$INSTALL_DIR" --strip-components=1

# Install dependencies
echo "📚 Installing dependencies..."
cd "\\$INSTALL_DIR"
npm install --production --silent 2>/dev/null

# Create executable
echo "🔧 Setting up command..."
mkdir -p "\\$INSTALL_DIR/bin"
cat > "\\$INSTALL_DIR/bin/prjct" <<'PRJCT_EOF'
#!/usr/bin/env node
require('../core/cli.js');
PRJCT_EOF
chmod +x "\\$INSTALL_DIR/bin/prjct"

# Install command globally
if [ -w "\\$BIN_DIR" ] || [ -w "/usr/local" ]; then
    sudo ln -sf "\\$INSTALL_DIR/bin/prjct" "\\$BIN_DIR/prjct" 2>/dev/null || {
        ln -sf "\\$INSTALL_DIR/bin/prjct" "\\$BIN_DIR/prjct"
    }
    COMMAND_PATH="\\$BIN_DIR/prjct"
else
    # Install in user directory
    mkdir -p "\\$HOME/bin"
    ln -sf "\\$INSTALL_DIR/bin/prjct" "\\$HOME/bin/prjct"
    COMMAND_PATH="\\$HOME/bin/prjct"

    # Add to PATH if not already there
    if [[ ":\\$PATH:" != *":\\$HOME/bin:"* ]]; then
        SHELL_RC=""
        if [ -n "\\$BASH_VERSION" ]; then
            SHELL_RC="\\$HOME/.bashrc"
        elif [ -n "\\$ZSH_VERSION" ]; then
            SHELL_RC="\\$HOME/.zshrc"
        fi

        if [ -n "\\$SHELL_RC" ]; then
            echo 'export PATH="\\$HOME/bin:\\$PATH"' >> "\\$SHELL_RC"
            echo -e "\\${YELLOW}Added \\$HOME/bin to PATH in \\$SHELL_RC\\${NC}"
            echo -e "\\${YELLOW}Please restart your terminal or run: source \\$SHELL_RC\\${NC}"
        fi
    fi
fi

# Setup MCP integration
echo "🤖 Configuring AI assistant integration..."
mkdir -p "\\$HOME/.config/claude-code"

cat > "\\$HOME/.config/claude-code/mcp-prjct.json" <<PRJCT_EOF
{
  "mcpServers": {
    "prjct": {
      "command": "node",
      "args": ["\\$INSTALL_DIR/mcp/server.js"],
      "env": {
        "PRJCT_HOME": "\\$INSTALL_DIR",
        "PRJCT_DATA": "\\$HOME/.prjct"
      }
    }
  }
}
PRJCT_EOF

# Cleanup
rm -f "\\$TEMP_FILE"
[ -d "\\$INSTALL_DIR.backup" ] && rm -rf "\\$INSTALL_DIR.backup"

# Success message
echo ""
echo -e "\\${GREEN}╔══════════════════════════════════════╗\\${NC}"
echo -e "\\${GREEN}║   ✅ prjct-cli installed successfully! ║\\${NC}"
echo -e "\\${GREEN}╚══════════════════════════════════════╝\\${NC}"
echo ""
echo -e "\\${BLUE}Getting Started:\\${NC}"
echo -e "  1. \\${GREEN}prjct init\\${NC} - Initialize a new project"
echo -e "  2. Use \\${GREEN}/p:\\${NC} commands in your AI assistant"
echo ""
echo -e "\\${BLUE}Available Commands:\\${NC}"
echo -e "  \\${GREEN}/p:now\\${NC} - Set current task"
echo -e "  \\${GREEN}/p:done\\${NC} - Complete task"
echo -e "  \\${GREEN}/p:ship\\${NC} - Ship a feature"
echo -e "  \\${GREEN}/p:recap\\${NC} - See progress"
echo ""
echo -e "Documentation: \\${BLUE}https://prjct-cli.vercel.app\\${NC}"
`;

  res.status(200).send(installScript);
}