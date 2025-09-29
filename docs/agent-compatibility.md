# Agent Compatibility Guide for prjct-cli

## Overview

prjct-cli features an intelligent agent detection system that automatically adapts to different AI environments:
- **Claude Code** (Anthropic)
- **OpenAI Codex** (GitHub)
- **Terminal/CLI** (Direct execution)

The system detects which agent is executing commands and adjusts behavior, formatting, and capabilities accordingly.

## How Agent Detection Works

### Detection Methods

The system uses multiple detection strategies in order:

1. **Environment Variables**
   - `CODEX_AGENT` or `OPENAI_CODEX` → OpenAI Codex
   - `CLAUDE_AGENT` or `ANTHROPIC_CLAUDE` → Claude Code
   - `CODESPACES` → GitHub Codespaces (Codex)

2. **Configuration Files**
   - Presence of `AGENTS.md` → OpenAI Codex
   - Presence of `CLAUDE.md` → Claude Code
   - `.claude` directory → Claude Code

3. **Runtime Capabilities**
   - MCP availability → Claude Code
   - Container environment → OpenAI Codex

4. **Filesystem Characteristics**
   - `/sandbox/` or `/tmp/codex/` paths → Codex
   - `/.claude/` or `/claude-workspace/` → Claude

### Agent Profiles

#### Claude Code
```javascript
{
  type: 'claude',
  name: 'Claude Code',
  capabilities: {
    mcp: true,              // MCP servers available
    filesystem: 'mcp',      // Uses MCP for file operations
    markdown: true,         // Rich markdown support
    emojis: true,          // Full emoji support
    colors: true,          // ANSI colors
    interactive: true      // Interactive mode
  },
  config: {
    configFile: 'CLAUDE.md',
    commandPrefix: '/p:',
    responseStyle: 'rich',
    dataDir: '.prjct'
  }
}
```

#### OpenAI Codex
```javascript
{
  type: 'codex',
  name: 'OpenAI Codex',
  capabilities: {
    mcp: false,            // No MCP servers
    filesystem: 'native',  // Direct fs operations
    markdown: true,        // Markdown support
    emojis: true,         // Emoji support
    colors: false,        // No ANSI colors (sandboxed)
    interactive: false    // Non-interactive
  },
  config: {
    configFile: 'AGENTS.md',
    commandPrefix: '/p:',
    responseStyle: 'structured',
    dataDir: '.prjct'
  }
}
```

#### Terminal/CLI
```javascript
{
  type: 'terminal',
  name: 'Terminal/CLI',
  capabilities: {
    mcp: false,           // No MCP
    filesystem: 'native', // Direct fs operations
    markdown: false,      // Plain text
    emojis: true,        // Emoji support
    colors: true,        // ANSI colors via chalk
    interactive: true    // Interactive mode
  },
  config: {
    configFile: null,
    commandPrefix: 'prjct',
    responseStyle: 'cli',
    dataDir: '.prjct'
  }
}
```

## Agent-Specific Features

### Response Formatting

#### Claude Code
- Rich markdown with **bold**, *italic*, and other formatting
- Full emoji support for visual feedback
- Structured output with clear sections
- Suggestions for next actions

Example:
```markdown
✅ **Task complete: implement auth**

💡 Ready for the next challenge? Use `/p:next` to see your queue!
```

#### OpenAI Codex
- Structured text output for sandboxed environment
- Clear prefixes: `[SUCCESS]`, `[ERROR]`, `[INFO]`
- Organized sections with separators
- Action-oriented suggestions

Example:
```
[SUCCESS] Task complete: implement auth

NEXT: Check task queue with /p:next
```

#### Terminal
- ANSI colors for enhanced readability
- Visual separators and formatting
- Progress indicators and spinners
- Interactive prompts

Example:
```
✅ Task complete: implement auth
→ Ready for the next challenge? Use prjct next to see your queue!
```

### File Operations

#### Claude Code
```javascript
// Uses MCP when available
await mcp.filesystem.read(path)
await mcp.filesystem.write(path, content)

// Falls back to native fs
await fs.readFile(path, 'utf8')
```

#### OpenAI Codex
```javascript
// Direct filesystem operations
await fs.readFile(path, 'utf8')
await fs.writeFile(path, content, 'utf8')

// Handles sandboxed paths
// Adapts to container restrictions
```

#### Terminal
```javascript
// Native filesystem with error handling
await fs.readFile(path, 'utf8')
// Colored error messages with chalk
```

## Testing Agent Detection

### Manual Testing

#### Test as Claude Code
```bash
export CLAUDE_AGENT=true
node bin/prjct context
# Should show: "Agent: Claude Code"
```

#### Test as OpenAI Codex
```bash
export CODEX_AGENT=true
node bin/prjct context
# Should show: "Agent: OpenAI Codex"
```

#### Test as Terminal
```bash
unset CLAUDE_AGENT CODEX_AGENT
node bin/prjct context
# Should show: "Agent: Terminal/CLI"
```

### Programmatic Testing
```javascript
const agentDetector = require('./core/agent-detector');

// Force specific agent for testing
agentDetector.setAgent('codex');
const info = await agentDetector.detect();
console.log(info.name); // "OpenAI Codex"

// Reset to auto-detection
agentDetector.reset();
```

## Troubleshooting

### Agent Not Detected Correctly

1. **Check Environment Variables**
   ```bash
   echo $CODEX_AGENT
   echo $CLAUDE_AGENT
   ```

2. **Verify Configuration Files**
   ```bash
   ls -la AGENTS.md CLAUDE.md .prjct-agent
   ```

3. **Force Detection**
   ```javascript
   // In your code
   const agentDetector = require('./core/agent-detector');
   agentDetector.setAgent('codex'); // or 'claude', 'terminal'
   ```

### Feature Not Working

Different agents have different capabilities:

| Feature | Claude | Codex | Terminal |
|---------|--------|-------|----------|
| MCP Servers | ✅ | ❌ | ❌ |
| Rich Markdown | ✅ | ✅ | ❌ |
| ANSI Colors | ✅ | ❌ | ✅ |
| Interactive | ✅ | ❌ | ✅ |
| Sandboxed | ❌ | ✅ | ❌ |

### Performance Issues

- **Claude Code**: MCP operations may add latency
- **Codex**: Sandboxed environment has resource limits
- **Terminal**: Direct execution is fastest

## Development Guidelines

### Adding New Agent Support

1. Create adapter in `core/agents/`:
```javascript
class NewAgent {
  formatResponse(message, type) { /* ... */ }
  readFile(path) { /* ... */ }
  writeFile(path, content) { /* ... */ }
  // ... other required methods
}
```

2. Update detection in `agent-detector.js`:
```javascript
detectByEnvironmentVariables() {
  if (process.env.NEW_AGENT) {
    return this.getNewAgent();
  }
}
```

3. Add to `commands.js` switch:
```javascript
switch (this.agentInfo.type) {
  case 'newagent':
    Agent = require('./agents/new-agent');
    break;
}
```

### Best Practices

1. **Always Test Detection**
   ```javascript
   await this.initializeAgent();
   console.log(`Detected: ${this.agentInfo.name}`);
   ```

2. **Use Agent Capabilities**
   ```javascript
   if (this.agentInfo.capabilities.mcp) {
     // Use MCP features
   } else {
     // Use native fallback
   }
   ```

3. **Adapt Response Style**
   ```javascript
   return this.agent.formatResponse(message, 'success');
   // Automatically uses appropriate formatting
   ```

## Configuration Files

### AGENTS.md (OpenAI Codex)
- Located at repository root
- Contains instructions for Codex agents
- Automatically detected by Codex platform

### CLAUDE.md (Claude Code)
- Located at repository root
- Contains instructions for Claude Code
- Used for Claude-specific configuration

### .prjct-agent (Runtime Marker)
- Created during initialization
- Contains: `agent-type:agent-name`
- Used for persistent agent detection

## Security Considerations

- **Sandboxed Environments**: Codex runs in isolated containers
- **File Access**: Agents only access project directories
- **No Network Access**: Commands don't make external requests
- **Local Data**: All data stays on developer's machine

## FAQ

**Q: Can I use prjct-cli with other AI assistants?**
A: Yes! The agent system is extensible. Create an adapter and update detection logic.

**Q: Why does formatting look different in different environments?**
A: Each agent optimizes output for its environment (rich markdown, structured text, or ANSI colors).

**Q: How do I know which agent is running?**
A: Run `/p:context` (or `prjct context` in terminal) to see current agent information.

**Q: Can I force a specific agent type?**
A: Yes, use environment variables or call `agentDetector.setAgent('type')`.

**Q: What if agent detection fails?**
A: The system falls back to terminal mode, which works universally.