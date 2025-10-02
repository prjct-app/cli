#!/bin/bash

# Verification script for all installation methods
# Tests that each method works correctly

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

CHECK="✓"
CROSS="✗"

echo ""
echo -e "${BOLD}${CYAN}prjct-cli Installation Methods Verification${NC}"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
test_start() {
    echo -e "${CYAN}Testing:${NC} $1"
}

test_pass() {
    echo -e "${GREEN}  ${CHECK} $1${NC}"
    ((TESTS_PASSED++))
}

test_fail() {
    echo -e "${RED}  ${CROSS} $1${NC}"
    ((TESTS_FAILED++))
}

test_skip() {
    echo -e "${YELLOW}  ⊘ $1${NC}"
}

# ============================================================================
# Test 1: Homebrew Availability
# ============================================================================

test_start "Homebrew availability"
if command -v brew &> /dev/null; then
    BREW_VERSION=$(brew --version | head -1)
    test_pass "Homebrew found: $BREW_VERSION"

    # Test tap availability
    if brew tap | grep -q "jlopezlira/prjct"; then
        test_pass "prjct tap is added"

        # Test formula availability
        if brew list prjct &> /dev/null; then
            test_pass "prjct formula is installed"
        else
            test_skip "prjct not installed via Homebrew (run: brew install prjct)"
        fi
    else
        test_skip "prjct tap not added (run: brew tap jlopezlira/prjct)"
    fi
else
    test_skip "Homebrew not installed"
fi

echo ""

# ============================================================================
# Test 2: Bun Availability
# ============================================================================

test_start "Bun availability"
if command -v bun &> /dev/null; then
    BUN_VERSION=$(bun --version)
    test_pass "Bun found: v$BUN_VERSION"

    # Test bunfig.toml
    if [ -f "bunfig.toml" ]; then
        test_pass "bunfig.toml exists"
    else
        test_fail "bunfig.toml missing"
    fi

    # Test Bun can run the CLI
    if bun run bin/prjct 2>&1 | grep -q "Available commands"; then
        test_pass "CLI runs with Bun"
    else
        test_fail "CLI fails with Bun"
    fi
else
    test_skip "Bun not installed"
fi

echo ""

# ============================================================================
# Test 3: Node.js/npm Availability
# ============================================================================

test_start "Node.js/npm availability"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    test_pass "Node.js found: $NODE_VERSION"

    # Check version >= 18
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        test_pass "Node.js version >= 18"
    else
        test_fail "Node.js version < 18 (found: $NODE_VERSION)"
    fi

    # Test package.json
    if [ -f "package.json" ]; then
        test_pass "package.json exists"

        # Test engines configuration
        if grep -q '"bun"' package.json; then
            test_pass "Bun engine specified in package.json"
        else
            test_fail "Bun engine missing in package.json"
        fi
    else
        test_fail "package.json missing"
    fi
else
    test_skip "Node.js not installed"
fi

echo ""

# ============================================================================
# Test 4: Installation Scripts
# ============================================================================

test_start "Installation scripts"

# Test install.sh
if [ -f "scripts/install.sh" ]; then
    test_pass "install.sh exists"
    if [ -x "scripts/install.sh" ]; then
        test_pass "install.sh is executable"
    else
        test_fail "install.sh is not executable"
    fi

    # Test script syntax
    if bash -n scripts/install.sh; then
        test_pass "install.sh syntax valid"
    else
        test_fail "install.sh has syntax errors"
    fi
else
    test_fail "install.sh missing"
fi

# Test install-brew.sh
if [ -f "scripts/install-brew.sh" ]; then
    test_pass "install-brew.sh exists"
    if bash -n scripts/install-brew.sh; then
        test_pass "install-brew.sh syntax valid"
    else
        test_fail "install-brew.sh has syntax errors"
    fi
else
    test_fail "install-brew.sh missing"
fi

# Test install-bun.sh
if [ -f "scripts/install-bun.sh" ]; then
    test_pass "install-bun.sh exists"
    if bash -n scripts/install-bun.sh; then
        test_pass "install-bun.sh syntax valid"
    else
        test_fail "install-bun.sh has syntax errors"
    fi
else
    test_fail "install-bun.sh missing"
fi

echo ""

# ============================================================================
# Test 5: Homebrew Formula
# ============================================================================

test_start "Homebrew formula"

if [ -f "Formula/prjct.rb" ]; then
    test_pass "Formula/prjct.rb exists"

    # Test formula syntax (requires Homebrew)
    if command -v brew &> /dev/null; then
        if brew audit --strict Formula/prjct.rb 2>&1 | grep -q "no offenses"; then
            test_pass "Formula syntax valid"
        else
            test_skip "Formula audit warnings (check with: brew audit Formula/prjct.rb)"
        fi
    else
        test_skip "Cannot audit formula (Homebrew not installed)"
    fi
else
    test_fail "Formula/prjct.rb missing"
fi

echo ""

# ============================================================================
# Test 6: Documentation
# ============================================================================

test_start "Documentation"

if [ -f "docs/INSTALL.md" ]; then
    test_pass "INSTALL.md exists"
else
    test_fail "INSTALL.md missing"
fi

if [ -f "docs/HOMEBREW_TAP.md" ]; then
    test_pass "HOMEBREW_TAP.md exists"
else
    test_fail "HOMEBREW_TAP.md missing"
fi

if grep -q "Homebrew" README.md; then
    test_pass "README mentions Homebrew installation"
else
    test_fail "README missing Homebrew installation"
fi

if grep -q "Bun" README.md; then
    test_pass "README mentions Bun installation"
else
    test_fail "README missing Bun installation"
fi

echo ""

# ============================================================================
# Test 7: GitHub Workflows
# ============================================================================

test_start "GitHub workflows"

if [ -f ".github/workflows/release.yml" ]; then
    test_pass "release.yml exists"
else
    test_fail "release.yml missing"
fi

if [ -f ".github/workflows/test-install.yml" ]; then
    test_pass "test-install.yml exists"
else
    test_fail "test-install.yml missing"
fi

echo ""

# ============================================================================
# Test 8: CLI Functionality
# ============================================================================

test_start "CLI functionality"

if [ -f "bin/prjct" ]; then
    test_pass "bin/prjct exists"

    if [ -x "bin/prjct" ]; then
        test_pass "bin/prjct is executable"
    else
        test_fail "bin/prjct is not executable"
    fi

    # Test CLI runs
    if node bin/prjct 2>&1 | grep -q "Available commands"; then
        test_pass "CLI runs and shows help"
    else
        test_fail "CLI fails to run"
    fi

    # Test core commands exist
    COMMANDS=("init" "now" "done" "ship" "next" "idea" "recap" "progress" "stuck" "context" "cleanup" "design" "analyze")
    FOUND_COMMANDS=0
    for cmd in "${COMMANDS[@]}"; do
        if node bin/prjct 2>&1 | grep -q "$cmd"; then
            ((FOUND_COMMANDS++))
        fi
    done

    if [ $FOUND_COMMANDS -eq ${#COMMANDS[@]} ]; then
        test_pass "All core commands present ($FOUND_COMMANDS/${#COMMANDS[@]})"
    else
        test_fail "Missing commands (found $FOUND_COMMANDS/${#COMMANDS[@]})"
    fi
else
    test_fail "bin/prjct missing"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================

echo -e "${BOLD}Test Summary${NC}"
echo "─────────────────────────────────────"
echo -e "${GREEN}Passed:${NC} $TESTS_PASSED"
echo -e "${RED}Failed:${NC} $TESTS_FAILED"
echo "─────────────────────────────────────"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}${BOLD}✗ Some tests failed${NC}"
    exit 1
fi
