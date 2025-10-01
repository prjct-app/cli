# Tests Directory

Testing utilities and test files for prjct-cli.

## Structure

```
tests/
├── README.md                    # This file
├── test-local.js               # Local testing script
├── agent-detection.test.js     # Agent detection tests
├── verify-install-paths.sh     # Installation verification
├── fixtures/                   # Test fixtures and sample files
│   └── package.bak.json        # Sample package.json for testing
└── INSTALL_PATH_FIX.md         # Installation path fix documentation
```

## Local Testing Script

### test-local.js

Script to test prjct-cli commands locally without full installation.

**Usage:**
```bash
# From project root
node tests/test-local.js [command] [arguments]
```

**Examples:**
```bash
node tests/test-local.js recap
node tests/test-local.js now "My test task"
node tests/test-local.js progress week
node tests/test-local.js next
```

**Features:**
- Mocks terminal agent for testing
- Executes commands directly without installation
- Simplified output for debugging
- Useful for development and quick verification

## Test Fixtures

### fixtures/package.bak.json

Test package.json used for:
- Testing stack detection (React, Jest, etc.)
- Verifying capability recommendations
- Testing interactive workflow system

**Usage in tests:**
```javascript
const testPackage = require('./fixtures/package.bak.json')
// Use for stack detection mocking
```

## Running Tests

### Unit Tests
```bash
npm test
```

### Agent Detection Tests
```bash
node tests/agent-detection.test.js
```

### Installation Verification
```bash
./tests/verify-install-paths.sh
```

### Local Command Testing
```bash
node tests/test-local.js [command]
```

## Adding New Tests

1. Create test file in `/tests`
2. Follow naming convention: `*.test.js`
3. Add fixtures to `/tests/fixtures` if needed
4. Update this README with test documentation

## Test Coverage

Current test coverage includes:
- ✅ Agent detection (Claude Code, Cursor, Windsurf, etc.)
- ✅ Installation path verification
- ✅ Local command execution
- 🔄 Stack detection (via fixtures)
- 🔄 Workflow system (via fixtures)

## Notes

- **test-local.js**: Runs commands without global installation
- **fixtures/**: Contains test files and mocks
- Keep fixtures updated with real dependency versions
