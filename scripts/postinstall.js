#!/usr/bin/env node

/**
 * postinstall - Minimal, reliable setup
 *
 * CRITICAL: Only copies p.md router to ~/.claude/commands/
 * p.md reads templates from npm root, so updates work automatically.
 * Statusline is best-effort (optional).
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const ROOT = path.resolve(__dirname, '..')
const HOME = os.homedir()
const CLAUDE_DIR = path.join(HOME, '.claude')
const COMMANDS_DIR = path.join(CLAUDE_DIR, 'commands')

console.log('\n   prjct-cli postinstall\n')

// 1. Copy p.md router (CRITICAL - this is the only essential file)
try {
  fs.mkdirSync(COMMANDS_DIR, { recursive: true })

  const pmdSrc = path.join(ROOT, 'templates', 'commands', 'p.md')
  const pmdDest = path.join(COMMANDS_DIR, 'p.md')

  if (fs.existsSync(pmdSrc)) {
    fs.copyFileSync(pmdSrc, pmdDest)
    console.log('   \u2713 p.md router installed')
  } else {
    console.log('   ! p.md not found in package')
  }
} catch (error) {
  console.log('   ! Could not install p.md:', error.message)
  console.log('   Run: npx prjct-cli setup')
}

// 2. Statusline (best-effort, not critical)
try {
  const STATUSLINE_SRC = path.join(ROOT, 'assets', 'statusline')
  const STATUSLINE_DEST = path.join(HOME, '.prjct-cli', 'statusline')

  if (fs.existsSync(STATUSLINE_SRC)) {
    // Create dirs
    fs.mkdirSync(path.join(STATUSLINE_DEST, 'lib'), { recursive: true })
    fs.mkdirSync(path.join(STATUSLINE_DEST, 'components'), { recursive: true })
    fs.mkdirSync(path.join(STATUSLINE_DEST, 'themes'), { recursive: true })

    // Copy main script
    const mainScript = path.join(STATUSLINE_SRC, 'statusline.sh')
    if (fs.existsSync(mainScript)) {
      fs.copyFileSync(mainScript, path.join(STATUSLINE_DEST, 'statusline.sh'))
      fs.chmodSync(path.join(STATUSLINE_DEST, 'statusline.sh'), 0o755)
    }

    // Copy subdirs
    for (const subdir of ['lib', 'components', 'themes']) {
      const srcDir = path.join(STATUSLINE_SRC, subdir)
      if (fs.existsSync(srcDir)) {
        for (const f of fs.readdirSync(srcDir)) {
          fs.copyFileSync(
            path.join(srcDir, f),
            path.join(STATUSLINE_DEST, subdir, f)
          )
        }
      }
    }

    // Default config (only if not exists)
    const configSrc = path.join(STATUSLINE_SRC, 'default-config.json')
    const configDest = path.join(STATUSLINE_DEST, 'config.json')
    if (fs.existsSync(configSrc) && !fs.existsSync(configDest)) {
      fs.copyFileSync(configSrc, configDest)
    }

    // Symlink in ~/.claude
    const symlinkPath = path.join(CLAUDE_DIR, 'prjct-statusline.sh')
    const targetPath = path.join(STATUSLINE_DEST, 'statusline.sh')
    try {
      if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath)
      if (fs.existsSync(targetPath)) fs.symlinkSync(targetPath, symlinkPath)
    } catch {
      // Symlink failed, copy instead
      if (fs.existsSync(targetPath)) {
        fs.copyFileSync(targetPath, symlinkPath)
        fs.chmodSync(symlinkPath, 0o755)
      }
    }

    // Update settings.json
    const settingsPath = path.join(CLAUDE_DIR, 'settings.json')
    let settings = {}
    if (fs.existsSync(settingsPath)) {
      try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) } catch {}
    }
    settings.statusLine = { type: 'command', command: symlinkPath }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))

    console.log('   \u2713 statusline installed')
  }
} catch {
  // Statusline is optional, don't fail
}

console.log('\n')
