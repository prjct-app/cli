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

If Claude assumes one package manager (say, npm) and you actually use pnpm, the install creates a SECOND prjct in your nvm bin dir while your existing pnpm install stays in `~/Library/pnpm/`. PATH resolution picks one — usually whichever is earlier — and you see a stale version. Aggressive cleanup of duplicates can leave your shell with NO working prjct.

The detection-first prompt avoids this entirely. It's also why the standalone-binary script (Path 2) detects existing installs and upgrades in-place rather than blindly creating new ones.

### Why detection in the prompt and not via npm?

The standalone binary install (`curl | bash`) is the cleanest no-package-manager path, but **Claude Code's harness intentionally blocks remote `curl | bash` execution for safety** — that's a sandbox policy, not something a prompt can or should bypass. The package-manager path runs through Claude Code's allowed tool surface.

If you want the standalone binary, see Path 2 (run yourself in a terminal).

---

## Path 2 — Standalone binary, run in your own terminal (no Node/npm needed)

If you'd rather have the standalone binary (Bun runtime embedded), open your own terminal and run:

```bash
curl -sSL https://raw.githubusercontent.com/jlopezlira/prjct-cli/main/scripts/install-via-claude.sh | bash
```

> **Note:** This is a `curl | bash` install. Run it from your own terminal, not via Claude Code — the Claude Code harness blocks remote `curl | bash` for safety, and that's the right call. Trust comes from you reading the script before running it. The script is here: [scripts/install-via-claude.sh](./scripts/install-via-claude.sh).

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

## Upgrade (3 ways, all equivalent)

| Method | Command | When to use |
|---|---|---|
| **Same paste prompt** | re-run Path 1 above | The default. Works whether prjct is installed or not. |
| **CLI shortcut** | `prjct update` | If you're already in a terminal with prjct installed. Auto-detects npm/pnpm/bun/yarn/homebrew and upgrades. |
| **Silent auto-update** | `prjct config set auto-update on` (one time) | Set and forget. Hook checks 1/hour throttled, upgrades in background, logs to `~/.prjct-cli/state/auto-update.log`. |

The `install-via-claude.sh` script's output explicitly distinguishes the path:

- `✓ prjct installed (via binary)` — fresh install
- `✓ prjct upgraded 2.4.20 → v2.4.26 (via binary)` — actual upgrade
- `✓ prjct re-verified at v2.4.26 (already current) (via binary)` — no-op (already latest)

---

## What gets installed

- **Binary** at `~/.prjct-cli/bin/prjct` (or via npm global, depending on path)
- **Skill** at `~/.claude/skills/prjct/SKILL.md` (auto-activates on memory + workflow requests)
- **Hooks** in `~/.claude/settings.json` (SessionStart, UserPromptSubmit, Stop, PostToolUse, PreToolUse, SubagentStart, CwdChanged)
- **Lookup-first block** between `<!-- prjct:start -->` markers in `~/.claude/CLAUDE.md`
- **Config dir** at `~/.prjct-cli/` (per-project SQLite under `projects/<id>/`)
- **Vault** at `~/Documents/prjct/<slug>/_generated/` (auto-regenerated, browsable in Obsidian)
- **Native SQLite binding** (`better-sqlite3`) for Node installs; verified during package install, `prjct install`, and daemon startup

Self-heal updates the CLAUDE.md block and hooks on every version bump — no manual `prjct setup` needed after upgrade.

---

## Verifying after install

In a fresh Claude Code session inside any prjct project:

1. Ask "what patterns does this project use?" — Claude should read `_generated/patterns.md`, NOT `grep -r` in source.
2. Ask "review my changes" — the prjct skill activates with Production Bug Hunt methodology.
3. Make some edits + close Claude — Stop hook auto-captures decisions/learnings (visible in `_generated/memory/decision.md`).
4. Open a second session in the same repo — prjct's hooks inject relevant memory, so you don't re-explain.
