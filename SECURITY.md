# Security Policy

## Supported Versions

The latest minor on `main` plus the previous minor receive security fixes. Older releases are not patched — upgrade with `bun install -g prjct-cli@latest` (or your installer of choice).

| Version | Supported |
| ------- | --------- |
| Latest 2.x | :white_check_mark: |
| Previous 2.x minor | :white_check_mark: |
| 1.x and older | :x: |

## Security Model

### Local-First Architecture

prjct-cli is designed with privacy and security as core principles:

- **All data stored locally** in `~/.prjct-cli/` - never transmitted externally
- **No telemetry or analytics** - we don't track usage
- **No cloud sync** - your productivity data stays on your machine
- **No external servers** - works entirely offline (except Claude integration)

### Data Policy

We store: project config (`.prjct/prjct.config.json`), task history (`~/.prjct-cli/projects/{id}/`), and session activity in SQLite. We do **not** store credentials, API keys, source code bodies (only paths for analysis), or personal info beyond the git author name/email already in your commits. `prjct remember` and `prjct capture` refuse content that looks like a secret or like a prompt-injection payload unless invoked with `--force`.

### Dependencies

We use minimal dependencies and audit them regularly:

- `npm audit` runs in CI on every push
- Dependencies are pinned to specific versions
- No dependencies with known critical vulnerabilities

## Reporting a Vulnerability

**DO NOT** open a public GitHub issue for security vulnerabilities.

### Contact

**Email:** jlopezlira@gmail.com

**Subject line:** `[SECURITY] prjct-cli vulnerability report`

### What to Include

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact assessment
4. Your contact information (for follow-up)

### Response Timeline

| Stage | Timeline |
|-------|----------|
| Initial acknowledgment | 48 hours |
| Vulnerability assessment | 7 days |
| Fix development | Depends on severity |
| Public disclosure | After fix is released |

### What to Expect

- We'll acknowledge receipt within 48 hours
- We'll assess severity and determine fix timeline
- We'll keep you updated on progress
- We'll credit you in release notes (unless you prefer anonymity)

## Security Best Practices for Users

1. **Keep prjct-cli updated** - Run `npm update -g prjct-cli` regularly
2. **Review before committing** - Check `.prjct/prjct.config.json` before pushing to public repos
3. **Avoid storing secrets** - Don't put API keys or passwords in `now.md` or `ideas.md`
4. **Use .gitignore** - The `.prjct/` directory should be in your `.gitignore` (auto-added by `prjct init`)

## Claude Integration Security

When using prjct-cli with Claude Code or Claude Desktop:

- Commands execute locally on your machine
- Claude only sees the context you provide via slash commands
- No data is stored on Anthropic's servers beyond standard Claude usage
- Review [Anthropic's privacy policy](https://www.anthropic.com/privacy) for Claude-specific details
