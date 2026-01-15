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

// Read version from package.json
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
const VERSION = pkg.version

console.log('\n   prjct-cli postinstall\n')

// 1. Copy p.md router (CRITICAL - main entry point)
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

// 2. Install individual commands as separate skills (p.task, p.sync, etc.)
try {
  const commandsDir = path.join(ROOT, 'templates', 'commands')
  const commands = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md') && f !== 'p.md')

  let installed = 0
  for (const cmd of commands) {
    const src = path.join(commandsDir, cmd)
    const cmdName = cmd.replace('.md', '')
    const dest = path.join(COMMANDS_DIR, `p.${cmdName}.md`)

    try {
      fs.copyFileSync(src, dest)
      installed++
    } catch {
      // Skip files that fail to copy
    }
  }

  console.log(`   \u2713 ${installed} individual commands installed (/p.task, /p.sync, etc.)`)
} catch (error) {
  console.log('   ! Could not install individual commands:', error.message)
}

// 3. Statusline (best-effort, not critical)
try {
  const STATUSLINE_SRC = path.join(ROOT, 'assets', 'statusline')
  const STATUSLINE_DEST = path.join(HOME, '.prjct-cli', 'statusline')

  if (fs.existsSync(STATUSLINE_SRC)) {
    // Create dirs
    fs.mkdirSync(path.join(STATUSLINE_DEST, 'lib'), { recursive: true })
    fs.mkdirSync(path.join(STATUSLINE_DEST, 'components'), { recursive: true })
    fs.mkdirSync(path.join(STATUSLINE_DEST, 'themes'), { recursive: true })

    // Copy main script with version patched
    const mainScript = path.join(STATUSLINE_SRC, 'statusline.sh')
    if (fs.existsSync(mainScript)) {
      let content = fs.readFileSync(mainScript, 'utf-8')
      content = content.replace(/CLI_VERSION="[^"]*"/, `CLI_VERSION="${VERSION}"`)
      fs.writeFileSync(path.join(STATUSLINE_DEST, 'statusline.sh'), content, { mode: 0o755 })
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
