#!/bin/bash

# Deployment script for prjct-cli to Vercel
# This is a private, non-open source project

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Deploying prjct-cli to Vercel...${NC}"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}Error: Vercel CLI is not installed${NC}"
    echo "Install with: npm i -g vercel"
    exit 1
fi

# Create build package
echo -e "${YELLOW}📦 Creating deployment package...${NC}"

# Create temp directory for build
BUILD_DIR="/tmp/prjct-build-$(date +%s)"
mkdir -p "$BUILD_DIR"

# Copy necessary files
cp -r api "$BUILD_DIR/"
cp -r core "$BUILD_DIR/"
cp -r adapters "$BUILD_DIR/"
cp -r templates "$BUILD_DIR/"
cp package.json "$BUILD_DIR/"
cp vercel.json "$BUILD_DIR/"

# Create minimal package.json for Vercel
cat > "$BUILD_DIR/package.json" <<EOF
{
  "name": "prjct-cli-server",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "tar": "^6.1.0"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}
EOF

# Deploy to Vercel
cd "$BUILD_DIR"

echo -e "${YELLOW}🌐 Deploying to Vercel...${NC}"

# Deploy with production flag
if [ "$1" = "production" ]; then
    vercel --prod --yes
else
    vercel --yes
fi

# Cleanup
cd - > /dev/null
rm -rf "$BUILD_DIR"

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}Installation URL:${NC}"
echo -e "  ${GREEN}curl -fsSL https://prjct-cli.vercel.app/install.sh | bash${NC}"
echo ""
echo -e "${BLUE}Website:${NC}"
echo -e "  ${GREEN}https://prjct-cli.vercel.app${NC}"