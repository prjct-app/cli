#!/bin/bash

# prjct-cli Installation Verification Script

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "🔍 prjct-cli Installation Verification"
echo "======================================="
echo ""

ERRORS=0
WARNINGS=0

# Function to check and report
check() {
    local description="$1"
    local condition="$2"

    if eval "$condition"; then
        echo -e "${GREEN}✅ $description${NC}"
        return 0
    else
        echo -e "${RED}❌ $description${NC}"
        ((ERRORS++))
        return 1
    fi
}

warn_check() {
    local description="$1"
    local condition="$2"

    if eval "$condition"; then
        echo -e "${GREEN}✅ $description${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  $description${NC}"
        ((WARNINGS++))
        return 1
    fi
}

# 1. Check installation directory
echo -e "${BLUE}📁 Checking installation...${NC}"
check "Installation directory exists" "[ -d $HOME/.prjct-cli ]"
check "Core directory exists" "[ -d $HOME/.prjct-cli/core ]"
check "Commands directory exists" "[ -d $HOME/.prjct-cli/commands ]"
check "Templates directory exists" "[ -d $HOME/.prjct-cli/templates ]"
echo ""

# 2. Check executable
echo -e "${BLUE}🔧 Checking executable...${NC}"
check "Binary exists" "[ -f $HOME/.prjct-cli/bin/prjct ]"
check "Binary is executable" "[ -x $HOME/.prjct-cli/bin/prjct ]"

# Check if in PATH
if command -v prjct &> /dev/null; then
    echo -e "${GREEN}✅ prjct command available in PATH${NC}"
else
    warn_check "prjct command in PATH" "false"
    echo "   Try: source ~/.bashrc or source ~/.zshrc"
fi
echo ""

# 3. Check Claude Code integration
echo -e "${BLUE}🤖 Checking Claude Code integration...${NC}"
if [ -d "$HOME/.claude" ]; then
    check "Claude directory detected" "true"
    check "Commands directory exists" "[ -d $HOME/.claude/commands/p ]"

    # Check individual command files
    for cmd in init now done ship next idea recap progress stuck context; do
        warn_check "Command /p:$cmd installed" "[ -f $HOME/.claude/commands/p/$cmd.md ]"
    done

    # Check if commands are readable by Claude
    if [ -f "$HOME/.claude/commands/p/init.md" ]; then
        if grep -q "allowed-tools:" "$HOME/.claude/commands/p/init.md"; then
            echo -e "${GREEN}✅ Commands have correct format${NC}"
        else
            echo -e "${YELLOW}⚠️  Commands may have incorrect format${NC}"
            ((WARNINGS++))
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Claude Code not detected${NC}"
    ((WARNINGS++))
fi
echo ""

# 4. Check Node.js dependencies
echo -e "${BLUE}📦 Checking dependencies...${NC}"
check "node_modules exists" "[ -d $HOME/.prjct-cli/node_modules ]"
check "package.json exists" "[ -f $HOME/.prjct-cli/package.json ]"

# Check specific dependencies
if [ -d "$HOME/.prjct-cli/node_modules" ]; then
    warn_check "commander installed" "[ -d $HOME/.prjct-cli/node_modules/commander ]"
    warn_check "chalk installed" "[ -d $HOME/.prjct-cli/node_modules/chalk ]"
    warn_check "ora installed" "[ -d $HOME/.prjct-cli/node_modules/ora ]"
fi
echo ""

# 5. Test basic functionality
echo -e "${BLUE}🧪 Testing functionality...${NC}"
cd /tmp
rm -rf .prjct 2>/dev/null

# Test prjct command if available
if command -v prjct &> /dev/null; then
    # Try to run help
    if prjct 2>&1 | grep -q "Available commands"; then
        echo -e "${GREEN}✅ prjct command works${NC}"
    else
        echo -e "${RED}❌ prjct command not working properly${NC}"
        ((ERRORS++))
    fi
else
    echo -e "${YELLOW}⚠️  Cannot test prjct command (not in PATH)${NC}"
    ((WARNINGS++))
fi

# Test direct execution
if $HOME/.prjct-cli/bin/prjct 2>&1 | grep -q "Available commands"; then
    echo -e "${GREEN}✅ Direct execution works${NC}"
else
    echo -e "${RED}❌ Direct execution not working${NC}"
    ((ERRORS++))
fi
echo ""

# Summary
echo "======================================="
if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}🎉 All checks passed! prjct-cli is ready to use.${NC}"
        echo ""
        echo "Try these commands:"
        echo "  In Claude Code: /p:init"
        echo "  In Terminal: prjct init"
    else
        echo -e "${GREEN}✅ Installation successful with $WARNINGS warnings.${NC}"
        echo ""
        echo "Some features may need attention, but prjct-cli should work."
    fi
else
    echo -e "${RED}❌ Installation has $ERRORS errors and $WARNINGS warnings.${NC}"
    echo ""
    echo "Please run the installer again:"
    echo "  cd ~/.prjct-cli && ./setup.sh"
fi
echo ""