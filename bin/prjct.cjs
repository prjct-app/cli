#!/usr/bin/env node

/**
 * Portable package-manager entry point for prjct.
 *
 * npm/pnpm/yarn/bun generate Windows shims correctly for node shebangs, but
 * not for the historical bin/prjct POSIX shell launcher. Keep this file tiny
 * and dependency-free so global installs work on macOS, Linux, and Windows.
 */

const childProcess = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const SCRIPT_PATH = fs.realpathSync(__filename)
const SCRIPT_DIR = path.dirname(SCRIPT_PATH)
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..')
const HOME = os.homedir()

function pathEntries() {
  return (process.env.PATH || '').split(path.delimiter).filter(Boolean)
}

function executableCandidates(command) {
  if (process.platform !== 'win32') return [command]
  const pathext = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .filter(Boolean)
    .map((ext) => ext.toLowerCase())
  const ext = path.extname(command).toLowerCase()
  if (ext && pathext.includes(ext)) return [command]
  return pathext.map((candidateExt) => `${command}${candidateExt.toLowerCase()}`)
}

function findCommand(command) {
  for (const dir of pathEntries()) {
    for (const candidate of executableCandidates(command)) {
      const fullPath = path.join(dir, candidate)
      try {
        fs.accessSync(fullPath, fs.constants.X_OK)
        return fullPath
      } catch {
        /* keep searching */
      }
    }
  }
  return null
}

function nodeVersionOk() {
  const match = process.versions.node.match(/^(\d+)\.(\d+)\./)
  const major = Number.parseInt(match?.[1] || '0', 10)
  const minor = Number.parseInt(match?.[2] || '0', 10)
  return major > 22 || (major === 22 && minor >= 5)
}

function withSqliteFlag(env = process.env) {
  const existing = env.NODE_OPTIONS || ''
  const flag = '--experimental-sqlite'
  return {
    ...env,
    NODE_OPTIONS: existing.includes(flag) ? existing : `${flag}${existing ? ` ${existing}` : ''}`,
  }
}

function spawnAndExit(command, args, options = {}) {
  const result = childProcess.spawnSync(command, args, {
    stdio: 'inherit',
    windowsHide: false,
    ...options,
  })

  if (result.error) {
    console.error(`Error: ${result.error.message}`)
    process.exit(1)
  }
  if (result.signal) {
    process.kill(process.pid, result.signal)
  }
  process.exit(result.status ?? 1)
}

function removeIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true })
  } catch {
    /* best effort */
  }
}

function copyIfNewer(src, dest) {
  try {
    if (!fs.existsSync(src)) return
    const srcStat = fs.statSync(src)
    const destStat = fs.existsSync(dest) ? fs.statSync(dest) : null
    if (destStat && destStat.mtimeMs >= srcStat.mtimeMs) return
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
  } catch {
    /* best effort */
  }
}

function copyDirContents(srcDir, destDir) {
  try {
    if (!fs.existsSync(srcDir)) return
    fs.mkdirSync(destDir, { recursive: true })
    for (const entry of fs.readdirSync(srcDir)) {
      fs.copyFileSync(path.join(srcDir, entry), path.join(destDir, entry))
    }
  } catch {
    /* best effort */
  }
}

function ensureSetup() {
  removeIfExists(path.join(HOME, '.claude', 'commands', 'p.md'))
  removeIfExists(path.join(HOME, '.gemini', 'commands', 'p.toml'))

  const statuslineSrc = path.join(ROOT_DIR, 'assets', 'statusline', 'statusline.sh')
  const statuslineDir = path.join(HOME, '.prjct-cli', 'statusline')
  const statuslineDest = path.join(statuslineDir, 'statusline.sh')
  const claudeStatusline = path.join(HOME, '.claude', 'prjct-statusline.sh')

  try {
    if (fs.existsSync(statuslineSrc)) {
      const needsCopy =
        !fs.existsSync(statuslineDest) ||
        fs.statSync(statuslineSrc).mtimeMs > fs.statSync(statuslineDest).mtimeMs
      if (needsCopy) {
        fs.mkdirSync(statuslineDir, { recursive: true })
        fs.copyFileSync(statuslineSrc, statuslineDest)
        fs.chmodSync(statuslineDest, 0o755)

        const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'))
        if (pkg.version) {
          const patched = fs
            .readFileSync(statuslineDest, 'utf-8')
            .replace(/CLI_VERSION="[^"]*"/, `CLI_VERSION="${pkg.version}"`)
          fs.writeFileSync(statuslineDest, patched)
        }

        for (const subdir of ['lib', 'components', 'themes']) {
          copyDirContents(
            path.join(ROOT_DIR, 'assets', 'statusline', subdir),
            path.join(statuslineDir, subdir)
          )
        }

        fs.mkdirSync(path.dirname(claudeStatusline), { recursive: true })
        removeIfExists(claudeStatusline)
        try {
          fs.symlinkSync(statuslineDest, claudeStatusline)
        } catch {
          fs.copyFileSync(statuslineDest, claudeStatusline)
        }
        fs.chmodSync(claudeStatusline, 0o755)
      }
    }
  } catch {
    /* best effort */
  }

  copyIfNewer(
    path.join(ROOT_DIR, 'templates', 'skills', 'prjct', 'SKILL.md'),
    path.join(HOME, '.claude', 'skills', 'prjct', 'SKILL.md')
  )

  if (fs.existsSync(path.join(HOME, '.codex')) || findCommand('codex')) {
    copyIfNewer(
      path.join(ROOT_DIR, 'templates', 'codex', 'SKILL.md'),
      path.join(HOME, '.codex', 'skills', 'prjct', 'SKILL.md')
    )
  }
}

function runMcpServer(args) {
  const mcpServer = path.join(ROOT_DIR, 'dist', 'mcp', 'server.mjs')
  if (!fs.existsSync(mcpServer)) {
    console.error("Error: MCP server entry point not found. Run 'npm run build' first.")
    process.exit(1)
  }
  if (!nodeVersionOk()) {
    console.error(
      `Error: prjct MCP needs Node >=22.5 (for node:sqlite) - found Node ${process.versions.node}.`
    )
    process.exit(1)
  }
  spawnAndExit(process.execPath, [mcpServer, ...args.slice(1)], { env: withSqliteFlag() })
}

function runWithNode(args) {
  const distBin = path.join(ROOT_DIR, 'dist', 'bin', 'prjct.mjs')

  if (!fs.existsSync(distBin)) {
    if (
      fs.existsSync(path.join(ROOT_DIR, 'scripts', 'build.js')) &&
      fs.existsSync(path.join(ROOT_DIR, 'core'))
    ) {
      console.error('Building for Node.js (first run)...')
      const build = childProcess.spawnSync(
        process.execPath,
        [path.join(ROOT_DIR, 'scripts', 'build.js')],
        {
          cwd: ROOT_DIR,
          stdio: 'inherit',
        }
      )
      if (build.status !== 0) {
        console.error("Error: Build failed. Run 'npm run build' manually.")
        process.exit(build.status ?? 1)
      }
    } else {
      console.error("Error: Compiled output not found. Run 'npm run build' first.")
      process.exit(1)
    }
  }

  if (!nodeVersionOk()) {
    console.error(
      `Error: prjct needs Node >=22.5 (for node:sqlite) - found Node ${process.versions.node}.`
    )
    console.error('  Upgrade Node (https://nodejs.org) or install Bun (https://bun.sh).')
    process.exit(1)
  }

  spawnAndExit(process.execPath, [distBin, ...args], { env: withSqliteFlag() })
}

function runWithBun(args) {
  if (process.platform === 'win32') return false
  const distBin = path.join(ROOT_DIR, 'dist', 'bin', 'prjct.mjs')
  const bun = findCommand('bun')
  if (!bun || !fs.existsSync(distBin)) return false
  spawnAndExit(bun, [distBin, ...args])
  return true
}

function main() {
  const args = process.argv.slice(2)
  if (args[0] === 'mcp-server') runMcpServer(args)

  ensureSetup()

  if (runWithBun(args)) return
  runWithNode(args)
}

main()
