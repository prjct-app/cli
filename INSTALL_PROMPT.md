# Install / Upgrade prjct via prompt (paste into Claude Code or any AI agent)

**The same prompt installs AND upgrades.** The script detects whether prjct is already on this machine and either does a fresh install or upgrades to the latest published version. Re-running is always safe.

Three paths, each smaller than the last. Pick the one your audience can follow.

---

## Path 1 — One paste in Claude Code (recommended, harness-friendly)

Copy the prompt below and paste it into the Claude Code chat. Claude runs `npm` directly — no sandbox restrictions, ~30 seconds end-to-end:

```text
Install or upgrade prjct (project memory + quality workflows for AI coding agents) on this machine:

1. Run `npm install -g prjct-cli@latest`
2. Run `prjct setup` to install Claude Code hooks + the global CLAUDE.md lookup-first block
3. If the cwd is a git repo, run `prjct sync` to register it
4. Verify with `prjct -v` and confirm the version

After install, the prjct skill activates on requests like "review this branch", "qa the UI", "security check", or "investigate this bug" — each with a named methodology (Production Bug Hunt, OWASP+STRIDE, Iron Law, Coverage Gate). Stop hook auto-captures decisions/learnings/gotchas + detects hot files, recurring bugs, and tech-debt growth so the next session compounds.
```

### Shorter version (if you want a one-liner prompt)

```text
Install or upgrade prjct on this machine: run `npm install -g prjct-cli@latest`, then `prjct setup`, then `prjct sync` if cwd is a git repo. Verify with `prjct -v`.
```

### Why npm and not the standalone binary?

The standalone binary install (`curl | bash`) is faster and Node-free, but **Claude Code's harness intentionally blocks remote `curl | bash` execution for safety** — that's a sandbox policy, not something a prompt can or should bypass. The npm path runs through Claude Code's allowed tool surface.

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

Self-heal updates the CLAUDE.md block and hooks on every version bump — no manual `prjct setup` needed after upgrade.

---

## Verifying after install

In a fresh Claude Code session inside any prjct project:

1. Ask "what patterns does this project use?" — Claude should read `_generated/patterns.md`, NOT `grep -r` in source.
2. Ask "review my changes" — the prjct skill activates with Production Bug Hunt methodology.
3. Make some edits + close Claude — Stop hook auto-captures decisions/learnings (visible in `_generated/memory/decision.md`).
4. Open a second session in the same repo — prjct's hooks inject relevant memory, so you don't re-explain.
