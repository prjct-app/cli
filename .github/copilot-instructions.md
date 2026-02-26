# prjct-cli — Copilot Instructions

TypeScript CLI tool. Context layer for AI coding agents.

## Commands

- Test: `npm test`
- Build: `npm run build`
- Lint: `npm run lint`

## Rules

- Strict TypeScript, no untyped `any`
- All storage through SQLite (`core/storage/database.ts`)
- Never write prjct data to repo root — use `~/.prjct-cli/projects/{projectId}/`
- Biome for lint/format
