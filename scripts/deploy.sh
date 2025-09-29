#!/bin/bash

# Deployment script for prjct-cli to GitHub
# This script helps prepare and push updates

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Preparing prjct-cli for GitHub deployment...${NC}"

# Make sure we're in git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Make install script executable
echo -e "${YELLOW}🔧 Making install script executable...${NC}"
chmod +x docs/install.sh

# Check if there are changes
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}📝 Uncommitted changes found${NC}"
    echo -e "${BLUE}Current status:${NC}"
    git status -s
    echo ""
    echo -n "Do you want to commit these changes? (y/N): "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo -n "Enter commit message: "
        read -r message
        git add .
        git commit -m "$message"
    fi
fi

# Push to GitHub
echo -e "${BLUE}📤 Pushing to GitHub...${NC}"
git push origin main

echo -e "${GREEN}✅ Code pushed to GitHub!${NC}"
echo ""
echo -e "${YELLOW}⚠️  GitHub Pages Deployment:${NC}"
echo -e "   1. Go to: ${BLUE}https://github.com/jlopezlira/prjct-cli/settings/pages${NC}"
echo -e "   2. Set Source: ${GREEN}Deploy from a branch${NC}"
echo -e "   3. Set Branch: ${GREEN}main${NC}"
echo -e "   4. Set Folder: ${GREEN}/docs${NC}"
echo -e "   5. Click ${GREEN}Save${NC}"
echo ""
echo -e "${BLUE}📋 Or use GitHub Actions (already configured):${NC}"
echo -e "   1. Go to: ${BLUE}Settings → Pages${NC}"
echo -e "   2. Set Source: ${GREEN}GitHub Actions${NC}"
echo ""
echo -e "${GREEN}✨ Your site will be available at:${NC}"
echo -e "   ${BLUE}https://jlopezlira.github.io/prjct-cli${NC}"
echo ""
echo -e "${GREEN}📦 Installation command:${NC}"
echo -e "   ${BLUE}curl -fsSL https://jlopezlira.github.io/prjct-cli/install.sh | bash${NC}"