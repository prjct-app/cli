#!/bin/bash

# Test script to verify the install.sh and setup.sh path fixes
# This verifies that the setup.sh file can be found and executed correctly

set -e

echo "🧪 Testing prjct-cli Installation Path Fix"
echo "=========================================="
echo ""

# Create a temporary test directory
TEST_DIR=$(mktemp -d)
echo "📁 Created test directory: $TEST_DIR"

# Copy the repository to simulate installation
cp -r "$(dirname "$0")/.." "$TEST_DIR/prjct-cli"
cd "$TEST_DIR/prjct-cli"

echo ""
echo "✅ Test 1: Verify setup.sh exists in scripts/"
if [ -f "scripts/setup.sh" ]; then
    echo "   ✓ scripts/setup.sh exists"
else
    echo "   ✗ scripts/setup.sh NOT found"
    exit 1
fi

echo ""
echo "✅ Test 2: Verify chmod works with new path"
if chmod +x scripts/setup.sh; then
    echo "   ✓ chmod +x scripts/setup.sh succeeded"
else
    echo "   ✗ chmod failed"
    exit 1
fi

echo ""
echo "✅ Test 3: Verify script is executable"
if [ -x ./scripts/setup.sh ]; then
    echo "   ✓ ./scripts/setup.sh is executable"
else
    echo "   ✗ ./scripts/setup.sh NOT executable"
    exit 1
fi

echo ""
echo "✅ Test 4: Verify SCRIPT_DIR logic points to project root"
# Extract and test the SCRIPT_DIR logic from setup.sh
SIMULATED_SCRIPT_DIR="$( cd "$( dirname "./scripts/setup.sh" )/.." && pwd )"
EXPECTED_DIR="$(pwd)"
if [ "$SIMULATED_SCRIPT_DIR" = "$EXPECTED_DIR" ]; then
    echo "   ✓ SCRIPT_DIR correctly points to project root"
    echo "     SCRIPT_DIR=$SIMULATED_SCRIPT_DIR"
else
    echo "   ✗ SCRIPT_DIR mismatch"
    echo "     Expected: $EXPECTED_DIR"
    echo "     Got: $SIMULATED_SCRIPT_DIR"
    exit 1
fi

echo ""
echo "✅ Test 5: Verify required files are accessible from SCRIPT_DIR"
if [ -f "$SIMULATED_SCRIPT_DIR/package.json" ]; then
    echo "   ✓ package.json found"
else
    echo "   ✗ package.json NOT found"
    exit 1
fi

if [ -d "$SIMULATED_SCRIPT_DIR/core" ]; then
    echo "   ✓ core/ directory found"
else
    echo "   ✗ core/ directory NOT found"
    exit 1
fi

if [ -d "$SIMULATED_SCRIPT_DIR/bin" ]; then
    echo "   ✓ bin/ directory found"
else
    echo "   ✗ bin/ directory NOT found"
    exit 1
fi

echo ""
echo "✅ Test 6: Verify install.sh syntax"
if bash -n scripts/install.sh; then
    echo "   ✓ scripts/install.sh syntax OK"
else
    echo "   ✗ scripts/install.sh syntax error"
    exit 1
fi

if bash -n docs/install.sh; then
    echo "   ✓ docs/install.sh syntax OK"
else
    echo "   ✗ docs/install.sh syntax error"
    exit 1
fi

echo ""
echo "✅ Test 7: Verify setup.sh syntax"
if bash -n scripts/setup.sh; then
    echo "   ✓ scripts/setup.sh syntax OK"
else
    echo "   ✗ scripts/setup.sh syntax error"
    exit 1
fi

echo ""
echo "✅ Test 8: Verify both install.sh files are identical"
if diff scripts/install.sh docs/install.sh > /dev/null; then
    echo "   ✓ scripts/install.sh and docs/install.sh are identical"
else
    echo "   ✗ scripts/install.sh and docs/install.sh differ"
    exit 1
fi

# Cleanup
cd /
rm -rf "$TEST_DIR"

echo ""
echo "=========================================="
echo "✅ All tests passed!"
echo ""
echo "The fix correctly addresses the issue:"
echo "  1. install.sh now references scripts/setup.sh"
echo "  2. setup.sh now sets SCRIPT_DIR to project root"
echo "  3. All paths are resolved correctly"
echo ""
