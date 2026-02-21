#!/bin/sh
# Auto-install Bun if not present (best-effort, never fails)
#
# Used by:
#   - scripts/postinstall.js (npm install)
#   - bin/prjct (first CLI invocation)
#
# NEVER exits with error — graceful fallback to Node.js

# Already installed? Done.
if command -v bun >/dev/null 2>&1; then
  exit 0
fi

# Also check ~/.bun/bin (may not be in PATH yet)
if [ -x "${BUN_INSTALL:-$HOME/.bun}/bin/bun" ]; then
  exit 0
fi

# Only attempt on supported platforms
case "$(uname -s)" in
  Darwin|Linux) ;;
  *)
    echo "  Bun auto-install not supported on $(uname -s). Using Node.js."
    exit 0
    ;;
esac

echo "  Installing Bun for optimal performance..."

# Official Bun installer (non-interactive)
if curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1; then
  # Source the new PATH
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"

  if command -v bun >/dev/null 2>&1; then
    echo "  ✓ Bun $(bun --version) installed"
    exit 0
  fi
fi

echo "  Bun auto-install skipped. Using Node.js (still works fine)."
exit 0
