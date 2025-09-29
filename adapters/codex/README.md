# OpenAI Codex Adapter for prjct-cli

This adapter enables prjct-cli commands to work seamlessly with OpenAI Codex agents.

## Overview

The OpenAI Codex adapter provides instructions and configuration for Codex agents to understand and execute prjct commands (`/p:*`) within the Codex platform.

## Files

- `PRJCT_COMMANDS.md` - Quick reference for all prjct commands
- `README.md` - This file, explaining the adapter

## How It Works

1. **AGENTS.md Recognition**: OpenAI Codex automatically detects and reads the AGENTS.md file at the repository root
2. **Command Parsing**: When users type `/p:` commands, Codex interprets them using the instructions
3. **Filesystem Operations**: Commands are executed through direct file manipulation in the `.prjct/` directory
4. **Response Formatting**: Codex returns emoji-enhanced, motivational responses

## Setup

No additional setup is required. The presence of AGENTS.md at the repository root is sufficient for Codex to understand the project structure and commands.

## Compatibility

This adapter is designed to work in:
- OpenAI Codex cloud containers
- GitHub Codex integrations
- Local Codex development environments

## Testing

To verify the adapter is working:
1. Open a repository with Codex
2. Run `/p:init` to initialize the project structure
3. Test other commands like `/p:now`, `/p:done`, `/p:ship`

## Cross-Platform Support

The prjct-cli system supports multiple AI assistants:
- **OpenAI Codex** (via AGENTS.md)
- **Claude Code** (via CLAUDE.md)
- **Warp Terminal** (via shell integration)

All adapters use the same underlying command structure and file formats, ensuring consistency across platforms.