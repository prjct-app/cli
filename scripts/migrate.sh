#!/bin/bash

# prjct-cli Migration Script
# Migrates flat .prjct/ structure to new layered architecture

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 prjct Migration Tool${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━"

# Check if .prjct exists
if [ ! -d ".prjct" ]; then
    echo -e "${YELLOW}⚠️  No .prjct directory found${NC}"
    echo "Run /p:init to create a new project structure"
    exit 0
fi

# Check if already migrated
if [ -d ".prjct/core" ] && [ -d ".prjct/progress" ]; then
    echo -e "${GREEN}✅ Already using layered structure!${NC}"
    exit 0
fi

echo -e "${YELLOW}📦 Found legacy .prjct structure${NC}"
echo "Starting migration to layered architecture..."
echo

# Create backup
echo "📸 Creating backup..."
cp -r .prjct .prjct.backup.$(date +%Y%m%d_%H%M%S)

# Create new structure
echo "🏗️  Creating layered structure..."
mkdir -p .prjct/{core,progress,planning,analysis,memory}

# Migrate core files
echo "📝 Migrating core files..."
[ -f ".prjct/now.md" ] && mv .prjct/now.md .prjct/core/now.md
[ -f ".prjct/next.md" ] && mv .prjct/next.md .prjct/core/next.md

# Create context.md if doesn't exist
if [ ! -f ".prjct/core/context.md" ]; then
    cat > .prjct/core/context.md << 'EOF'
# Project Context

## Overview
Migrated from legacy structure

## Current Focus
See now.md for current task

## Key Information
Run `/p:analyze` to generate project analysis
EOF
fi

# Migrate progress files
echo "📈 Migrating progress tracking..."
[ -f ".prjct/shipped.md" ] && mv .prjct/shipped.md .prjct/progress/shipped.md

# Create metrics.md if doesn't exist
if [ ! -f ".prjct/progress/metrics.md" ]; then
    cat > .prjct/progress/metrics.md << 'EOF'
# Progress Metrics

## This Week
- **Shipped**: 0 features
- **Active**: 0 tasks
- **Planned**: 0 items

## Historical
Metrics will be updated by commands
EOF
fi

# Migrate planning files
echo "💡 Migrating planning files..."
[ -f ".prjct/ideas.md" ] && mv .prjct/ideas.md .prjct/planning/ideas.md

# Create roadmap.md if doesn't exist
if [ ! -f ".prjct/planning/roadmap.md" ]; then
    cat > .prjct/planning/roadmap.md << 'EOF'
# Roadmap

## Current Sprint
Active items from next.md

## Upcoming
Planned features and improvements

## Long-term Vision
Strategic goals and objectives
EOF
fi

# Migrate memory files
echo "🧠 Migrating memory files..."
[ -f ".prjct/memory.jsonl" ] && mv .prjct/memory.jsonl .prjct/memory/context.jsonl
[ -f ".prjct/decisions.jsonl" ] && mv .prjct/decisions.jsonl .prjct/memory/decisions.jsonl
[ -f ".prjct/learnings.jsonl" ] && mv .prjct/learnings.jsonl .prjct/memory/learnings.jsonl

# Create empty JSONL files if needed
touch .prjct/memory/context.jsonl
touch .prjct/memory/decisions.jsonl
touch .prjct/memory/learnings.jsonl

# Clean up old files
echo "🧹 Cleaning up..."
find .prjct -maxdepth 1 -type f -delete 2>/dev/null || true

echo
echo -e "${GREEN}✅ Migration complete!${NC}"
echo
echo "📂 New structure:"
echo "   .prjct/"
echo "   ├── 🎯 core/      (now.md, next.md, context.md)"
echo "   ├── 📈 progress/  (shipped.md, metrics.md)"
echo "   ├── 💡 planning/  (ideas.md, roadmap.md)"
echo "   ├── 🔍 analysis/  (will be created by /p:analyze)"
echo "   └── 🧠 memory/    (context.jsonl, decisions.jsonl)"
echo
echo "💡 Next steps:"
echo "   1. Run ${BLUE}/p:analyze${NC} to generate repository analysis"
echo "   2. Run ${BLUE}/p:recap${NC} to see your migrated data"
echo "   3. Continue using prjct commands as usual!"
echo
echo "📸 Backup saved to: .prjct.backup.*"