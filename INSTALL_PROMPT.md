# Install / Upgrade prjct via prompt (paste into Claude Code or any AI agent)

**The same prompt installs AND upgrades.** The script detects whether prjct is already on this machine and either does a fresh install or upgrades to the latest published version. Re-running is always safe.

Three paths, each smaller than the last. Pick the one your audience can follow.

---

## Path 1 — One paste in Claude Code (recommended, harness-friendly + package-manager-aware)

Copy the prompt below and paste it into the Claude Code chat. Claude detects YOUR package manager and uses it — does NOT force npm:

```text
Install or upgrade prjct (project memory + quality workflows for AI coding agents) on this machine.

1. Detect which package manager I use globally. Check `command -v pnpm`, `command -v bun`, `command -v yarn`, `command -v npm` in that order. ALSO check `command -v prjct` — if there's an existing install, identify which package manager owns it (pnpm path, bun path, etc.) and use the SAME one to upgrade in-place. This is critical: using a different package manager creates a parallel install that shadows the existing one and breaks PATH resolution.

2. Run the install with the detected package manager:
   - pnpm: `pnpm install -g prjct-cli@latest`
   - bun:  `bun install -g prjct-cli@latest`
   - yarn: `yarn global add prjct-cli@latest`
   - npm:  `npm install -g prjct-cli@latest`
   - homebrew: `brew upgrade prjct-cli` (or `brew install prjct-cli`)

3. Run `prjct install` to verify/repair required native dependencies (SQLite / better-sqlite3) and install hooks. This command must not block the setup if repair is deferred; daemon startup retries the repair.
4. Run `prjct setup` to install provider config + the global CLAUDE.md lookup-first block.
5. If the cwd is a git repo, run `prjct sync` to register it.
6. Verify with `prjct -v` and tell me which package manager you used.

After install, the prjct skill activates on requests like "review this branch", "qa the UI", "security check", or "investigate this bug" — each with a named methodology (Production Bug Hunt, OWASP+STRIDE, Iron Law, Coverage Gate). Stop hook auto-captures decisions/learnings/gotchas + detects hot files, recurring bugs, and tech-debt growth so the next session compounds.
```

### Shorter version (one-liner)

```text
Install or upgrade prjct: detect my package manager (pnpm > bun > yarn > npm in preference order; reuse the one that owns any existing prjct install), run the matching `<pm> install -g prjct-cli@latest` (or `yarn global add` / `brew upgrade prjct-cli`), then `prjct install`, then `prjct setup`, then `prjct sync` if cwd is git. Verify with `prjct -v`.
```

### Why detection matters

If Claude assumes one package manager and you actually use another, the install creates a SECOND prjct in a parallel bin dir while the existing install stays put — PATH resolution picks one and you see a stale version. The detection-first prompt and the standalone-binary script (Path 2) both upgrade in-place to avoid this.

---

## Path 2 — Standalone binary, run in your own terminal (no Node/npm needed)

If you'd rather have the standalone binary (Bun runtime embedded), open your own terminal and run:

```bash
curl -sSL https://raw.githubusercontent.com/prjct-app/prjct-cli/main/scripts/install-standalone.sh | bash
```

> **Note:** This is a `curl | bash` install. Run it from your own terminal, not via Claude Code — the Claude Code harness blocks remote `curl | bash` for safety, and that's the right call. Trust comes from you reading the script before running it. The script is here: [scripts/install-standalone.sh](./scripts/install-standalone.sh).

The script:
1. Detects platform (macOS arm64/intel + Linux x64)
2. Downloads the standalone binary from the latest GitHub Release
3. Symlinks `~/.prjct-cli/bin/prjct` → `~/.local/bin/prjct` (added to `$PATH`)
4. Falls back to `npm install -g prjct-cli@latest` if binary download fails
5. Runs `prjct setup` (hooks + global CLAUDE.md) and `prjct sync` (if cwd is git repo)
6. Warns if a stale package-manager install (pnpm / yarn / brew / bun) is shadowing the new binary on PATH

---

## Path 3 — Package manager fallback

For users who want the npm path:

```bash
npm install -g prjct-cli@latest
prjct install # verifies native SQLite dependency + hooks
prjct sync   # in any git repo
```

Or `bun install -g prjct-cli@latest`.

---

## Optional follow-ups

```bash
prjct config set auto-update on    # silent self-update, throttled 1/hour
prjct config set suggestions off   # mute proactive workflow nudges
prjct team --enforce               # require prjct in this repo (pre-commit hook)
```

## Upgrade

Re-run Path 1 (works whether installed or not), or `prjct update` from a terminal (auto-detects the package manager), or `prjct config set auto-update on` for silent background updates throttled to 1/hour. See README.md for the full upgrade table.

---

## What gets installed

- **Binary** at `~/.prjct-cli/bin/prjct` (or via npm global, depending on path)
- **Skill** at `~/.claude/skills/prjct/SKILL.md` (auto-activates on memory + workflow requests)
- **Hooks** in `~/.claude/settings.json` (SessionStart, UserPromptSubmit, Stop, PostToolUse, PreToolUse, SubagentStart, CwdChanged)
- **Lookup-first block** between `<!-- prjct:start -->` markers in `~/.claude/CLAUDE.md`
- **Config dir** at `~/.prjct-cli/` (per-project SQLite under `projects/<id>/`)
- **Native SQLite binding** (`better-sqlite3`) for Node installs; verified during package install, `prjct install`, and daemon startup

Self-heal updates the CLAUDE.md block and hooks on every version bump — no manual `prjct setup` needed after upgrade.

---

## Verifying after install

In a fresh Claude Code session inside any prjct project:

1. Ask "what patterns does this project use?" — Claude should call MCP `prjct_analysis`, NOT `grep -r` in source.
2. Ask "review my changes" — the prjct skill activates with Production Bug Hunt methodology.
3. Make some edits + close Claude — Stop hook auto-captures decisions/learnings (verify with `prjct search "<topic>"`).
4. Open a second session in the same repo — prjct's hooks inject relevant memory, so you don't re-explain.
