/**
 * Shell script templates for prjct git hooks.
 *
 * The shell wrapper stays POSIX-small so Git can execute it on macOS,
 * Linux, and Git for Windows. Rate limiting and background spawn happen in
 * Node to avoid platform-specific utilities like md5sum, stat, or date.
 */

function getPortableSyncBody(): string {
  return `# prjct sync --quiet --yes
if command -v node >/dev/null 2>&1; then
  node <<'NODE' >/dev/null 2>&1 || true
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')

const cwd = process.cwd()
const key = crypto.createHash('sha1').update(cwd).digest('hex')
const lockFile = path.join(os.tmpdir(), 'prjct-sync-' + key + '.lock')
const now = Date.now()

try {
  const ageMs = now - fs.statSync(lockFile).mtimeMs
  if (ageMs < 30_000) process.exit(0)
} catch {
  // no lock yet
}

try {
  fs.writeFileSync(lockFile, String(now))
} catch {
  // best effort; sync is still allowed
}

const command = process.platform === 'win32' ? 'prjct.cmd' : 'prjct'
const child = spawn(command, ['sync', '--quiet', '--yes'], {
  cwd,
  detached: true,
  stdio: 'ignore',
})
child.unref()
NODE
fi`
}

export function getPostCommitScript(): string {
  return `#!/bin/sh
# prjct auto-sync hook (post-commit)
# Syncs project context after each commit
# Installed by: prjct hooks install

# prjct:auto-sync:start
${getPortableSyncBody()}
# prjct:auto-sync:end

exit 0
`
}

export function getPostCheckoutScript(): string {
  return `#!/bin/sh
# prjct auto-sync hook (post-checkout)
# Syncs project context after branch switch
# Installed by: prjct hooks install

# prjct:auto-sync:start
# Only run on branch checkout (not file checkout)
# $3 is the checkout type flag: 1 = branch, 0 = file
if [ "$3" != "1" ]; then
  exit 0
fi

# Skip if old and new refs are the same (no actual branch change)
if [ "$1" = "$2" ]; then
  exit 0
fi

${getPortableSyncBody()}
# prjct:auto-sync:end

exit 0
`
}
