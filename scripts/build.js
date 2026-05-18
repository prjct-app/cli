#!/usr/bin/env node

/**
 * Build Script for prjct-cli
 *
 * Produces a complete dist/ for npm publishing:
 * - dist/bin/prjct.mjs     CLI entry point (ESM, minified, sourcemapped)
 * - dist/templates.json    All templates bundled into single JSON
 *
 * @version 3.0.0
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

/**
 * Ensure esbuild is available
 */
function ensureEsbuild() {
  try {
    require.resolve('esbuild')
    return true
  } catch {
    console.log('Installing esbuild...')
    try {
      execSync('npm install esbuild --save-dev', { cwd: ROOT, stdio: 'inherit' })
      return true
    } catch (error) {
      console.error('Failed to install esbuild:', error.message)
      return false
    }
  }
}

/**
 * Clean and create dist directory
 */
function clean() {
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true })
  }
  fs.mkdirSync(DIST, { recursive: true })
  fs.mkdirSync(path.join(DIST, 'bin'), { recursive: true })
  fs.mkdirSync(path.join(DIST, 'cli'), { recursive: true })
  fs.mkdirSync(path.join(DIST, 'daemon'), { recursive: true })
  fs.mkdirSync(path.join(DIST, 'mcp'), { recursive: true })
}

/**
 * esbuild plugin: strip shebangs from source files.
 * Prevents double-shebang when banner also injects one.
 */
function stripShebangPlugin() {
  return {
    name: 'strip-shebang',
    setup(build) {
      build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async (args) => {
        const source = await require('node:fs/promises').readFile(args.path, 'utf-8')
        if (!source.startsWith('#!')) return undefined
        return {
          contents: source.replace(/^#![^\n]*\n/, ''),
          loader: args.path.endsWith('.ts') ? 'ts' : 'js',
        }
      })
    },
  }
}

/**
 * Build CLI entry point plus tracker CLIs
 */
async function buildJs() {
  const esbuild = require('esbuild')

  // 1a. CLI core bundle (heavy, only loaded when daemon unavailable)
  console.log('  → dist/bin/prjct-core.mjs')
  const mainResult = await esbuild.build({
    entryPoints: [path.join(ROOT, 'bin/prjct.ts')],
    outfile: path.join(DIST, 'bin', 'prjct-core.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    minify: true,
    keepNames: true,
    packages: 'external',
    metafile: true,
    banner: {
      js: `import { createRequire as __createRequire } from 'module';
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __pathDirname } from 'path';
var require = __createRequire(import.meta.url);
var __filename = __fileURLToPath(import.meta.url);
var __dirname = __pathDirname(__filename);`,
    },
  })

  // 1b. Thin shim entry point (tries daemon first, ~3KB, <15ms parse)
  console.log('  → dist/bin/prjct.mjs (daemon shim)')
  const shimSource = generateDaemonShim()
  fs.writeFileSync(path.join(DIST, 'bin', 'prjct.mjs'), shimSource)
  fs.chmodSync(path.join(DIST, 'bin', 'prjct.mjs'), 0o755)

  // 2. Daemon entry point (ESM, minified — spawned as background process)
  console.log('  → dist/daemon/entry.mjs')
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'core/daemon/entry.ts')],
    outfile: path.join(DIST, 'daemon', 'entry.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    minify: true,
    keepNames: true,
    packages: 'external',
    plugins: [stripShebangPlugin()],
    banner: {
      js: `#!/usr/bin/env node
import { createRequire as __createRequire } from 'module';
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __pathDirname } from 'path';
var require = __createRequire(import.meta.url);
var __filename = __fileURLToPath(import.meta.url);
var __dirname = __pathDirname(__filename);`,
    },
  })
  fs.chmodSync(path.join(DIST, 'daemon', 'entry.mjs'), 0o755)

  // 5. MCP Server (ESM, minified — stdio entry for MCP protocol)
  console.log('  → dist/mcp/server.mjs')
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'core/mcp/entry.ts')],
    outfile: path.join(DIST, 'mcp', 'server.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    minify: true,
    keepNames: true,
    packages: 'external',
    plugins: [stripShebangPlugin()],
    banner: {
      js: `#!/usr/bin/env node
import { createRequire as __createRequire } from 'module';
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __pathDirname } from 'path';
var require = __createRequire(import.meta.url);
var __filename = __fileURLToPath(import.meta.url);
var __dirname = __pathDirname(__filename);`,
    },
  })
  fs.chmodSync(path.join(DIST, 'mcp', 'server.mjs'), 0o755)

  return mainResult.metafile
}

/**
 * Generate the daemon shim — a tiny (<3KB) CLI entry point that:
 * 1. Checks if daemon socket exists (fs.existsSync)
 * 2. If yes: connects, sends command, prints output, exits
 * 3. If no: dynamically imports the heavy prjct-core.mjs bundle
 *
 * This avoids parsing the ~600KB core bundle when daemon handles the command.
 */
function generateDaemonShim() {
  // Fallback policy MUST mirror bin/prjct.ts:206-251 + core/daemon/client.ts:87-145:
  //
  //   - Timeout = 30s (sendRequest uses 30_000).
  //   - On socket error: fall through ONLY for ECONNREFUSED / ENOENT (stale
  //     socket, no listener — the request never reached a daemon, safe to
  //     re-run). Anything else (timeout, "Connection closed before response",
  //     misc network errors) MAY mean the daemon already started executing
  //     the request, so re-running can double-bump version / double-push.
  //   - On socket close before response: NEVER fall through — exit 1.
  //
  // This blocked the bin/prjct.ts hardening from commit d08727b8 from
  // reaching production for ~10 days (the shim is what end users actually
  // execute via dist/bin/prjct.mjs). Any future change to the fallback
  // policy MUST update both this string and bin/prjct.ts.
  return `#!/usr/bin/env node
import{connect}from"node:net";import{existsSync}from"node:fs";import{randomUUID}from"node:crypto";import{homedir}from"node:os";
const sockPath=homedir()+"/.prjct-cli/run/daemon.sock";
const args=process.argv.slice(2);
const cmd=args.find(a=>!a.startsWith("-"));
const skip=new Set(["daemon","stop","restart","start","setup","update","upgrade","dev","web","serve","context","hooks","doctor","uninstall","watch","help","-h","--help","version","-v","--version","claude","hook","seed","install","crew","mcp","prefs","retro","health","skill-adherence","review-risk","context-save","context-restore","spec","audit-spec"]);
function refuse(m){console.error("prjct: daemon dropped the request ("+m+"). Retry: prjct "+args.join(" "));process.exit(1)}
function isSafeRetry(e){const c=e&&e.code||"",m=e&&e.message||"";return c==="ECONNREFUSED"||c==="ENOENT"||m.includes("ECONNREFUSED")||m.includes("ENOENT")}
if(cmd&&!skip.has(cmd)&&process.env.PRJCT_NO_DAEMON!=="1"&&existsSync(sockPath)){
  const cArgs=[],cOpts={};
  for(let i=0;i<args.length;i++){const a=args[i];if(a.startsWith("--")){const r=a.slice(2);if(r.includes("=")){const e=r.indexOf("=");cOpts[r.slice(0,e)]=r.slice(e+1)}else if(i+1<args.length&&!args[i+1].startsWith("--")){cOpts[r]=args[++i]}else{cOpts[r]=true}}else if(a.startsWith("-")&&a.length===2){cOpts[a.slice(1)]=true}else if(i>0){cArgs.push(a)}}
  const msg=JSON.stringify({id:randomUUID(),command:cmd,args:cArgs,options:cOpts,cwd:process.cwd()})+"\\n";
  const sock=connect(sockPath);let buf="",done=false;
  const t=setTimeout(()=>{if(!done){done=true;sock.destroy();refuse("timed out")}},30000);
  sock.on("connect",()=>sock.write(msg));
  sock.on("data",c=>{buf+=c.toString();const n=buf.indexOf("\\n");if(n!==-1){const r=JSON.parse(buf.slice(0,n));done=true;clearTimeout(t);sock.end();if(r.stdout)console.log(r.stdout);if(r.stderr)console.error(r.stderr);process.exit(r.exitCode)}});
  sock.on("error",e=>{if(!done){done=true;clearTimeout(t);if(isSafeRetry(e))fallback();else refuse(e&&e.message||String(e))}});
  sock.on("close",()=>{if(!done){done=true;clearTimeout(t);refuse("Connection closed before response")}});
}else{fallback()}
async function fallback(){await import("./prjct-core.mjs")}
`
}

/**
 * Generate templates/skills/prjct/SKILL.md from the SSOT TS module.
 *
 * The static template the bin shim copies into ~/.claude/skills/prjct/
 * is derived from `core/services/skill-generator/prjct-skill-body.ts`,
 * the same module `prjct sync` uses to regenerate project-aware skills.
 * Single source of truth — no risk of the static and dynamic versions
 * drifting.
 *
 * Runs as a child bun process: the source is TS, build.js is plain JS.
 */
function generateSkillTemplate() {
  const script = path.join(ROOT, 'scripts', 'generate-skill-template.ts')
  // Prefer bun (fast TS execution); fall back to skipping with a warning
  // if bun isn't on PATH (dev machines without bun still get a working
  // build — the template just won't refresh until they install bun).
  try {
    execSync(`bun "${script}"`, { cwd: ROOT, stdio: 'inherit' })
  } catch (error) {
    console.warn(`  ⚠ skipped skill template generation (${error.message.split('\n')[0]})`)
  }
}

/**
 * Bundle all templates into a single JSON file
 *
 * Structure: { "commands/p.md": "...", "global/CLAUDE.md": "...", ... }
 * Keys are relative paths from templates/ directory.
 */
function bundleTemplates() {
  const templatesDir = path.join(ROOT, 'templates')
  const bundle = {}
  let fileCount = 0

  function walk(dir, prefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue
      const fullPath = path.join(dir, entry.name)
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        walk(fullPath, relativePath)
      } else {
        bundle[relativePath] = fs.readFileSync(fullPath, 'utf-8')
        fileCount++
      }
    }
  }

  walk(templatesDir, '')

  // Architecture guard: no shipped template may instruct an agent to write
  // outside the DB or the regenerated vault. The list below tracks the
  // disk-pollution paths we've explicitly retired:
  //   - .prjct/sessions/      — crew templates (closed in v2.19.6 / PR #330)
  //   - .prjct/CHECKPOINTS.md — moved to kv_store crew:checkpoints (spec a50b32d1)
  //   - .prjct/team.json      — moved to kv_store team:enrollment + derived
  //                              mirror (spec a50b32d1; the mirror still lives
  //                              on disk but is REGENERATED from DB by
  //                              `prjct team`, never template-written)
  // Templates must not reference any of these paths.
  const forbiddenSubstrings = ['.prjct/sessions/', '.prjct/CHECKPOINTS.md', '.prjct/team.json']
  const offenders = []
  for (const [relPath, content] of Object.entries(bundle)) {
    for (const needle of forbiddenSubstrings) {
      if (content.includes(needle)) offenders.push(`${relPath}: contains "${needle}"`)
    }
  }
  if (offenders.length > 0) {
    console.error('\n✗ Template bundle contains forbidden persistence paths:')
    for (const line of offenders) console.error(`  - ${line}`)
    console.error(
      '\n  prjct ships only two persistence surfaces: SQLite (~/.prjct-cli/projects/<id>/) and the regenerated vault (~/Documents/prjct/<slug>/_generated/).'
    )
    console.error('  Templates must not instruct agents to write anywhere else.')
    process.exit(1)
  }

  const outPath = path.join(DIST, 'templates.json')
  fs.writeFileSync(outPath, JSON.stringify(bundle))

  console.log(`  → dist/templates.json (${fileCount} files)`)
  return fileCount
}

/**
 * Print build summary with file sizes
 */
function printSummary() {
  console.log('\nBuild output:')

  // List all files in dist/ (including code-split chunks)
  const files = []
  function walkDist(dir, prefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walkDist(path.join(dir, entry.name), rel)
      } else {
        files.push(rel)
      }
    }
  }
  walkDist(DIST, '')

  let totalSize = 0
  for (const file of files) {
    const filePath = path.join(DIST, file)
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath)
      totalSize += stat.size
      const sizeKb = (stat.size / 1024).toFixed(1)
      console.log(`  ${file.padEnd(25)} ${sizeKb} KB`)
    }
  }

  console.log(`  ${'─'.repeat(40)}`)
  console.log(`  ${'Total'.padEnd(25)} ${(totalSize / 1024).toFixed(1)} KB`)
}

/**
 * Main
 */
async function main() {
  console.log('prjct-cli build script v3.0')
  console.log('==========================\n')

  if (!ensureEsbuild()) {
    process.exit(1)
  }

  clean()

  console.log('Compiling TypeScript...')
  await buildJs()

  console.log('\nGenerating skill template (SSOT: prjct-skill-body.ts)...')
  generateSkillTemplate()

  console.log('\nBundling templates...')
  bundleTemplates()

  printSummary()
  console.log('\nBuild complete!')
}

main().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
