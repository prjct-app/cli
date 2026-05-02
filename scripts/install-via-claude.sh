#!/usr/bin/env bash
#
# prjct — single-paste install.
#
# Designed to be invoked by pasting one line into Claude Code (or any
# AI agent's chat) and letting the agent execute it. Goal: zero terminal
# friction AND zero npm/Node dependency at install time.
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/jlopezlira/prjct-cli/main/scripts/install-via-claude.sh | bash
#
# What it does:
#   1. Detects platform (mac arm64/intel + linux x64)
#   2. Tries to download the standalone binary from the latest GitHub
#      release (no npm needed). Falls through to npm/bun on failure.
#   3. Installs to ~/.prjct-cli/bin/prjct, symlinks to ~/.local/bin/prjct
#      (or /usr/local/bin/prjct as fallback)
#   4. Runs `prjct setup` to install hooks + the global CLAUDE.md block
#   5. If the cwd is a git repo, runs `prjct sync` to register the project

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

PRJCT_DIR="${PRJCT_DIR:-$HOME/.prjct-cli}"
BIN_DIR="$PRJCT_DIR/bin"
LOCAL_BIN="$HOME/.local/bin"

# ---------------------------------------------------------------------------
# 1. Platform detection
# ---------------------------------------------------------------------------

step "Detecting platform…"
KERNEL="$(uname -s | tr '[:upper:]' '[:lower:]')"
MACHINE="$(uname -m)"
ASSET=""
case "$KERNEL/$MACHINE" in
  darwin/arm64|darwin/aarch64) ASSET="prjct-darwin-arm64" ;;
  darwin/x86_64)               ASSET="prjct-darwin-x64" ;;
  linux/x86_64)                ASSET="prjct-linux-x64" ;;
  *) note "no standalone binary for $KERNEL/$MACHINE — will try package manager fallback" ;;
esac
[ -n "$ASSET" ] && note "platform: $ASSET"

# ---------------------------------------------------------------------------
# 2a. Try standalone binary first (the user's preferred path — no npm)
# ---------------------------------------------------------------------------

INSTALLED_VIA="binary"
DOWNLOAD_OK=false

if [ -n "$ASSET" ]; then
  step "Fetching latest release metadata…"
  LATEST_TAG="$(curl -sSL --fail https://api.github.com/repos/jlopezlira/prjct-cli/releases/latest \
    | grep -oE '"tag_name":\s*"[^"]+"' | head -1 | cut -d '"' -f4 || true)"

  if [ -n "$LATEST_TAG" ]; then
    URL="https://github.com/jlopezlira/prjct-cli/releases/download/$LATEST_TAG/$ASSET"
    note "downloading $LATEST_TAG → $URL"
    mkdir -p "$BIN_DIR"
    if curl -sSL --fail -o "$BIN_DIR/prjct.new" "$URL"; then
      chmod +x "$BIN_DIR/prjct.new"
      mv "$BIN_DIR/prjct.new" "$BIN_DIR/prjct"
      DOWNLOAD_OK=true
    else
      warn "binary download failed (release asset may not exist yet for this version) — falling back to package manager"
      rm -f "$BIN_DIR/prjct.new"
    fi
  else
    warn "could not query GitHub releases — falling back to package manager"
  fi
fi

# ---------------------------------------------------------------------------
# 2b. Package manager fallback
# ---------------------------------------------------------------------------

if [ "$DOWNLOAD_OK" = false ]; then
  INSTALLED_VIA="pkg-manager"
  step "Falling back to package manager…"
  if command -v bun >/dev/null 2>&1; then
    note "using Bun $(bun --version)"
    bun install -g prjct-cli@latest >/dev/null 2>&1 || fail "bun install failed"
  elif command -v npm >/dev/null 2>&1; then
    note "using npm $(npm --version)"
    npm install -g prjct-cli@latest >/dev/null 2>&1 || fail "npm install failed"
  else
    fail "Neither standalone binary nor a runtime (Bun/npm) is available. Install Bun: https://bun.sh"
  fi
fi

# ---------------------------------------------------------------------------
# 3. Symlink so `prjct` is on PATH
# ---------------------------------------------------------------------------

if [ "$INSTALLED_VIA" = "binary" ]; then
  step "Adding prjct to PATH…"
  mkdir -p "$LOCAL_BIN"
  ln -sf "$BIN_DIR/prjct" "$LOCAL_BIN/prjct"
  if ! echo "$PATH" | tr ':' '\n' | grep -qx "$LOCAL_BIN"; then
    # Append PATH export to the user's shell rc, with a guard comment.
    SHELL_RC=""
    case "${SHELL:-}" in
      */zsh)  SHELL_RC="$HOME/.zshrc" ;;
      */bash) SHELL_RC="$HOME/.bashrc" ;;
    esac
    if [ -n "$SHELL_RC" ]; then
      if ! grep -qF "# prjct: add ~/.local/bin to PATH" "$SHELL_RC" 2>/dev/null; then
        printf "\n# prjct: add ~/.local/bin to PATH\nexport PATH=\"\$HOME/.local/bin:\$PATH\"\n" >> "$SHELL_RC"
        note "appended PATH export to $SHELL_RC — open a new shell or run 'source $SHELL_RC'"
      fi
    else
      warn "couldn't detect your shell rc — add this to your shell config: export PATH=\"\$HOME/.local/bin:\$PATH\""
    fi
  fi
  # Make `prjct` resolvable in this script run too.
  export PATH="$LOCAL_BIN:$PATH"
fi

# Verify install
if ! command -v prjct >/dev/null 2>&1; then
  fail "prjct didn't end up on PATH — please add $LOCAL_BIN to your PATH manually"
fi

NEW="$(prjct -v 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo unknown)"
note "installed v$NEW (via $INSTALLED_VIA)"

# ---------------------------------------------------------------------------
# 4. Setup (hooks + global CLAUDE.md)
# ---------------------------------------------------------------------------

step "Wiring hooks + global CLAUDE.md (lookup-first)…"
PRJCT_NONINTERACTIVE=1 prjct setup --quiet 2>/dev/null || warn "setup encountered non-fatal warnings; check 'prjct doctor' if anything looks off"

# ---------------------------------------------------------------------------
# 5. Register cwd if it's a git repo
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

VERB="installed"
if [ -n "$CURRENT" ] && [ "$CURRENT" != "$NEW" ]; then
  VERB="upgraded $CURRENT → v$NEW"
elif [ -n "$CURRENT" ] && [ "$CURRENT" = "$NEW" ]; then
  VERB="re-verified at v$NEW (already current)"
fi

printf "\n${GREEN}✓${NC} prjct %s (via $INSTALLED_VIA).\n" "$VERB"
printf "${DIM}  Next:${NC}\n"
printf "${DIM}    - Open Claude Code in any project — the lookup-first protocol kicks in automatically${NC}\n"
printf "${DIM}    - Try: prjct capture \"a thought\"  or  prjct task \"the thing I'm working on\"${NC}\n"
printf "${DIM}    - Quality workflows: ask Claude to \"review\", \"qa\", \"investigate\", or \"security check\" the current branch.${NC}\n"
printf "${DIM}    - Re-run this same command anytime to upgrade to the latest version.${NC}\n"
