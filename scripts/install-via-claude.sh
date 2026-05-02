#!/usr/bin/env bash
#
# prjct — single-paste install.
#
# Designed to be invoked by pasting one line into Claude Code (or any
# AI agent's chat) and letting the agent execute it. Goal: zero terminal
# friction.
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/jlopezlira/prjct-cli/main/scripts/install-via-claude.sh | bash
#
# What it does:
#   1. Detects the runtime (bun > node)
#   2. Installs / upgrades prjct-cli to the latest published version
#   3. Runs `prjct setup` to install hooks + the global CLAUDE.md block
#   4. If the cwd is a git repo, runs `prjct sync` to register the project
#
# Idempotent: re-running after upgrades only does the diff. Network or
# permission failures fail loud so the user knows what to fix.

set -euo pipefail

# ---------------------------------------------------------------------------
# Pretty output (still quiet enough that an LLM can quote the whole run
# back to the user without spam)
# ---------------------------------------------------------------------------

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
DIM='\033[2m'
NC='\033[0m'

step() { printf "${GREEN}▸${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}⚠${NC}  %s\n" "$1"; }
fail() { printf "${RED}✗${NC} %s\n" "$1" >&2; exit 1; }
note() { printf "${DIM}  %s${NC}\n" "$1"; }

# ---------------------------------------------------------------------------
# 1. Runtime detection
# ---------------------------------------------------------------------------

step "Detecting runtime…"
RUNTIME=""
if command -v bun >/dev/null 2>&1; then
  RUNTIME="bun"
  note "found Bun $(bun --version)"
elif command -v npm >/dev/null 2>&1; then
  RUNTIME="npm"
  note "found npm $(npm --version)"
else
  fail "Neither Bun nor npm/Node found. Install one first: https://bun.sh or https://nodejs.org"
fi

# ---------------------------------------------------------------------------
# 2. Install or upgrade prjct-cli
# ---------------------------------------------------------------------------

CURRENT=""
if command -v prjct >/dev/null 2>&1; then
  CURRENT="$(prjct -v 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)"
fi

if [ -n "$CURRENT" ]; then
  step "Upgrading prjct-cli (current: v$CURRENT)…"
else
  step "Installing prjct-cli…"
fi

if [ "$RUNTIME" = "bun" ]; then
  bun install -g prjct-cli@latest >/dev/null 2>&1 || fail "bun install failed"
else
  npm install -g prjct-cli@latest >/dev/null 2>&1 || fail "npm install failed"
fi

NEW="$(prjct -v 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo unknown)"
note "installed v$NEW"

# ---------------------------------------------------------------------------
# 3. Setup (hooks + global CLAUDE.md)
# ---------------------------------------------------------------------------

step "Wiring hooks + global CLAUDE.md (lookup-first)…"
# `prjct setup` is interactive when stdin is a TTY. Force the headless
# path here so we don't hang in `bash -c` from an LLM-driven invocation.
PRJCT_NONINTERACTIVE=1 prjct setup --quiet 2>/dev/null || warn "setup encountered non-fatal warnings; check 'prjct doctor' if anything looks off"

# ---------------------------------------------------------------------------
# 4. If we're in a git repo, register the project
# ---------------------------------------------------------------------------

if git rev-parse --show-toplevel >/dev/null 2>&1; then
  step "Registering this project (cwd is a git repo)…"
  prjct sync --quiet 2>/dev/null || note "sync skipped — run 'prjct sync' manually if you need to refresh"
else
  note "cwd is not a git repo — skipping project registration. cd into a project and run 'prjct sync' to register it."
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

printf "\n${GREEN}✓${NC} prjct v$NEW ready.\n"
printf "${DIM}  Next:${NC}\n"
printf "${DIM}    - Open Claude Code in any project — the lookup-first protocol kicks in automatically${NC}\n"
printf "${DIM}    - Try: /p:remember decision \"…\"  or  prjct capture \"…\"${NC}\n"
printf "${DIM}    - Quality workflows live inside the prjct skill: ask Claude to \"review\", \"qa\", \"investigate\", or \"security check\" the current branch.${NC}\n"
