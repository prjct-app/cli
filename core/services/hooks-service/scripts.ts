/**
 * Shell script templates for prjct git hooks.
 *
 * Both scripts include rate limiting (skip if synced within last 30s)
 * and run sync in background with output suppressed so they never
 * block a commit or branch switch.
 */

export function getPostCommitScript(): string {
  return `#!/bin/sh
# prjct auto-sync hook (post-commit)
# Syncs project context after each commit
# Installed by: prjct hooks install

# Rate limit: skip if synced within last 30 seconds
LOCK_FILE="\${TMPDIR:-/tmp}/prjct-sync-$(pwd | md5sum 2>/dev/null | cut -d' ' -f1 || md5 -q -s "$(pwd)").lock"
if [ -f "$LOCK_FILE" ]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -f%m "$LOCK_FILE" 2>/dev/null || stat -c%Y "$LOCK_FILE" 2>/dev/null || echo 0) ))
  if [ "$LOCK_AGE" -lt 30 ]; then
    exit 0
  fi
fi

# Run sync in background, suppress all output
if command -v prjct >/dev/null 2>&1; then
  touch "$LOCK_FILE"
  prjct sync --quiet --yes >/dev/null 2>&1 &
fi

exit 0
`
}

export function getPostCheckoutScript(): string {
  return `#!/bin/sh
# prjct auto-sync hook (post-checkout)
# Syncs project context after branch switch
# Installed by: prjct hooks install

# Only run on branch checkout (not file checkout)
# $3 is the checkout type flag: 1 = branch, 0 = file
if [ "$3" != "1" ]; then
  exit 0
fi

# Skip if old and new refs are the same (no actual branch change)
if [ "$1" = "$2" ]; then
  exit 0
fi

# Rate limit: skip if synced within last 30 seconds
LOCK_FILE="\${TMPDIR:-/tmp}/prjct-sync-$(pwd | md5sum 2>/dev/null | cut -d' ' -f1 || md5 -q -s "$(pwd)").lock"
if [ -f "$LOCK_FILE" ]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -f%m "$LOCK_FILE" 2>/dev/null || stat -c%Y "$LOCK_FILE" 2>/dev/null || echo 0) ))
  if [ "$LOCK_AGE" -lt 30 ]; then
    exit 0
  fi
fi

# Run sync in background, suppress all output
if command -v prjct >/dev/null 2>&1; then
  touch "$LOCK_FILE"
  prjct sync --quiet --yes >/dev/null 2>&1 &
fi

exit 0
`
}
