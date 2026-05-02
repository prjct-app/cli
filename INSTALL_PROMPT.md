# Install prjct via prompt (paste into Claude Code or any AI agent)

Three install paths, each smaller than the last. Pick the one your audience can follow.

---

## Path 1 — One paste in Claude Code (recommended)

Paste this into the Claude Code chat. Claude executes it and you're done in ~30 seconds:

> Install prjct (project memory + quality workflows for AI coding agents) on this machine:
>
> 1. Run `curl -sSL https://raw.githubusercontent.com/jlopezlira/prjct-cli/main/scripts/install-via-claude.sh | bash`
> 2. Verify with `prjct -v` (should print v2.4.x or higher)
> 3. If the cwd is a git repo, run `prjct sync` to register it
> 4. Show me the install output and confirm the version
>
> The script downloads the standalone binary for my platform from GitHub Releases (no Node/npm needed), wires hooks + the lookup-first CLAUDE.md block, and registers the project. After install, the prjct skill activates on requests like "review this branch", "qa the UI", "security check", or "investigate this bug" — each with a named methodology (Production Bug Hunt, OWASP+STRIDE, Iron Law, Coverage Gate). Stop hook auto-captures decisions/learnings/gotchas + detects hot files, recurring bugs, and tech-debt growth so the next session compounds.

---

## Path 2 — One terminal line

For users who prefer a terminal:

```bash
curl -sSL https://raw.githubusercontent.com/jlopezlira/prjct-cli/main/scripts/install-via-claude.sh | bash
```

The script:
1. Detects platform (macOS arm64/intel + Linux x64)
2. Downloads the standalone binary from the latest GitHub Release
3. Symlinks `~/.prjct-cli/bin/prjct` → `~/.local/bin/prjct` (added to `$PATH`)
4. Falls back to `npm install -g prjct-cli@latest` if binary download fails
5. Runs `prjct setup` (hooks + global CLAUDE.md) and `prjct sync` (if cwd is git repo)

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
