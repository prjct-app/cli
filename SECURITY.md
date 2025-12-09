# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.11.x  | :white_check_mark: |
| 0.10.x  | :white_check_mark: |
| < 0.10  | :x:                |

## Security Model

### Local-First Architecture

prjct-cli is designed with privacy and security as core principles:

- **All data stored locally** in `~/.prjct-cli/` - never transmitted externally
- **No telemetry or analytics** - we don't track usage
- **No cloud sync** - your productivity data stays on your machine
- **No external servers** - works entirely offline (except Claude integration)

### What We Store

| Data | Location | Purpose |
|------|----------|---------|
| Project config | `.prjct/prjct.config.json` | Project identification |
| Task history | `~/.prjct-cli/projects/{id}/` | Progress tracking |
| Session logs | `memory/context.jsonl` | Activity history |

### What We DON'T Store

- No credentials or API keys
- No source code content (only file paths for analysis)
- No personal information beyond git author name/email
- No sensitive data from your codebase

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
4. **Use .gitignore** - The `.prjct/` directory should be in your `.gitignore` (auto-added by `/p:init`)

## Claude Integration Security

When using prjct-cli with Claude Code or Claude Desktop:

- Commands execute locally on your machine
- Claude only sees the context you provide via slash commands
- No data is stored on Anthropic's servers beyond standard Claude usage
- Review [Anthropic's privacy policy](https://www.anthropic.com/privacy) for Claude-specific details
