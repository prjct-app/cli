#!/bin/bash

# prjct-cli installer
# Open Source Project - MIT License
# Repository: https://github.com/jlopezlira/prjct-cli

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="$HOME/.prjct-cli"
BIN_DIR="/usr/local/bin"
GITHUB_USER="jlopezlira"
GITHUB_REPO="prjct-cli"
GITHUB_URL="https://github.com/${GITHUB_USER}/${GITHUB_REPO}"

# Banner
echo -e "${PURPLE}╔══════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║       ${BLUE}Installing prjct-cli${PURPLE}          ║${NC}"
echo -e "${PURPLE}║   ${GREEN}AI Project Management Tool${PURPLE}        ║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════╝${NC}"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get OS type
get_os() {
    case "$(uname -s)" in
        Linux*)     echo "Linux";;
        Darwin*)    echo "Mac";;
        CYGWIN*)    echo "Windows";;
        MINGW*)     echo "Windows";;
        *)          echo "Unknown";;
    esac
}

OS_TYPE=$(get_os)
echo -e "${BLUE}ℹ️  Detected OS:${NC} $OS_TYPE"

# Check for required dependencies
echo -e "${YELLOW}📋 Checking requirements...${NC}"

MISSING_DEPS=()

if ! command_exists node; then
    MISSING_DEPS+=("Node.js")
fi

if ! command_exists npm; then
    MISSING_DEPS+=("npm")
fi

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required dependencies:${NC}"
    for dep in "${MISSING_DEPS[@]}"; do
        echo -e "   ${RED}•${NC} $dep"
    done
    echo ""
    echo -e "${YELLOW}Please install Node.js first:${NC}"
    echo -e "   ${BLUE}https://nodejs.org${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All requirements met${NC}"

# Check if already installed
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}⚠️  Found existing installation${NC}"
    echo -n "Do you want to update/reinstall? (y/N): "
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Installation cancelled${NC}"
        exit 0
    fi
    echo -e "${YELLOW}📦 Backing up existing installation...${NC}"
    rm -rf "$INSTALL_DIR.backup"
    mv "$INSTALL_DIR" "$INSTALL_DIR.backup"
fi

# Download and install
echo -e "${BLUE}📥 Downloading prjct-cli...${NC}"

if command_exists git; then
    # Prefer git clone for better experience
    echo -e "${GREEN}Using git clone...${NC}"
    git clone "$GITHUB_URL.git" "$INSTALL_DIR" --depth=1 --quiet
else
    # Fallback to downloading archive
    echo -e "${GREEN}Downloading archive...${NC}"
    TEMP_FILE=$(mktemp)
    curl -fsSL "${GITHUB_URL}/archive/main.tar.gz" -o "$TEMP_FILE"

    echo -e "${BLUE}📂 Extracting files...${NC}"
    mkdir -p "$INSTALL_DIR"
    tar -xzf "$TEMP_FILE" -C "$INSTALL_DIR" --strip-components=1
    rm -f "$TEMP_FILE"
fi

# Install dependencies
echo -e "${BLUE}📚 Installing dependencies...${NC}"
cd "$INSTALL_DIR"
npm install --production --silent 2>/dev/null || npm install --production

# Create executable wrapper
echo -e "${BLUE}🔧 Setting up command...${NC}"
mkdir -p "$INSTALL_DIR/bin"

cat > "$INSTALL_DIR/bin/prjct" <<'EOF'
#!/usr/bin/env node
const path = require('path');
const cli = require(path.join(__dirname, '..', 'core', 'cli.js'));
cli.run();
EOF

chmod +x "$INSTALL_DIR/bin/prjct"

# Install command globally
echo -e "${BLUE}🔗 Installing prjct command...${NC}"

# Try to install in system bin
if [ -w "$BIN_DIR" ] || [ -w "/usr/local" ]; then
    # Try without sudo first
    if ln -sf "$INSTALL_DIR/bin/prjct" "$BIN_DIR/prjct" 2>/dev/null; then
        COMMAND_PATH="$BIN_DIR/prjct"
    else
        # Need sudo
        echo -e "${YELLOW}Need sudo access to install globally${NC}"
        sudo ln -sf "$INSTALL_DIR/bin/prjct" "$BIN_DIR/prjct"
        COMMAND_PATH="$BIN_DIR/prjct"
    fi
else
    # Install in user's bin directory
    USER_BIN="$HOME/.local/bin"
    mkdir -p "$USER_BIN"
    ln -sf "$INSTALL_DIR/bin/prjct" "$USER_BIN/prjct"
    COMMAND_PATH="$USER_BIN/prjct"

    # Add to PATH if not already there
    ADD_PATH=false
    if [[ ":$PATH:" != *":$USER_BIN:"* ]]; then
        ADD_PATH=true
    fi

    if [ "$ADD_PATH" = true ]; then
        echo -e "${YELLOW}📝 Adding $USER_BIN to PATH...${NC}"

        # Add to appropriate shell config
        if [ -f "$HOME/.zshrc" ]; then
            echo "export PATH=\"$USER_BIN:\$PATH\"" >> "$HOME/.zshrc"
            SHELL_CONFIG="$HOME/.zshrc"
        elif [ -f "$HOME/.bashrc" ]; then
            echo "export PATH=\"$USER_BIN:\$PATH\"" >> "$HOME/.bashrc"
            SHELL_CONFIG="$HOME/.bashrc"
        else
            echo "export PATH=\"$USER_BIN:\$PATH\"" >> "$HOME/.profile"
            SHELL_CONFIG="$HOME/.profile"
        fi

        echo -e "${YELLOW}⚠️  PATH updated in $SHELL_CONFIG${NC}"
        echo -e "${YELLOW}   Run: ${GREEN}source $SHELL_CONFIG${NC}"
    fi
fi

# Setup MCP integration for AI assistants
echo -e "${BLUE}🤖 Configuring AI assistant integration...${NC}"

# Create MCP config directory
MCP_DIR="$HOME/.config/claude-code"
mkdir -p "$MCP_DIR"

# Create MCP server configuration
cat > "$MCP_DIR/prjct-mcp.json" <<EOF
{
  "mcpServers": {
    "prjct": {
      "command": "node",
      "args": ["$INSTALL_DIR/adapters/mcp/server.js"],
      "env": {
        "PRJCT_HOME": "$INSTALL_DIR",
        "PRJCT_DATA": "$HOME/.prjct"
      }
    }
  }
}
EOF

echo -e "${GREEN}✅ MCP integration configured${NC}"

# Clean up backup if everything succeeded
if [ -d "$INSTALL_DIR.backup" ]; then
    rm -rf "$INSTALL_DIR.backup"
fi

# Success message
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║    🎉 prjct-cli installed successfully!   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 Installation Summary:${NC}"
echo -e "   • Installed to: ${GREEN}$INSTALL_DIR${NC}"
echo -e "   • Command path: ${GREEN}$COMMAND_PATH${NC}"
echo -e "   • MCP config:   ${GREEN}$MCP_DIR/prjct-mcp.json${NC}"
echo ""
echo -e "${BLUE}🚀 Getting Started:${NC}"
echo -e "   1. Initialize a project:  ${GREEN}prjct init${NC}"
echo -e "   2. Use in AI assistants:  ${GREEN}/p:${NC} commands"
echo ""
echo -e "${BLUE}📚 Available Commands:${NC}"
echo -e "   ${GREEN}/p:now${NC}    - Set current task"
echo -e "   ${GREEN}/p:done${NC}   - Complete task"
echo -e "   ${GREEN}/p:ship${NC}   - Ship a feature"
echo -e "   ${GREEN}/p:recap${NC}  - Show progress"
echo ""
echo -e "${BLUE}📖 Documentation:${NC}"
echo -e "   ${GREEN}$GITHUB_URL${NC}"
echo ""

# Check if need to restart shell
if [ "$ADD_PATH" = true ]; then
    echo -e "${YELLOW}⚠️  Remember to restart your terminal or run:${NC}"
    echo -e "   ${GREEN}source $SHELL_CONFIG${NC}"
fi