# Testing Guide

prjct-cli uses **Vitest** for testing across both the **CLI core** (Node.js) and **website** (React + TypeScript) components.

## Quick Start

```bash
# Run all tests (core + website)
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Architecture

The project uses a **Vitest workspace** configuration to test two distinct environments:

1. **Core CLI** (Node.js) - Unit tests for CLI commands, utilities, and agentic system
2. **Website** (React + TypeScript) - Component tests with React Testing Library

### Workspace Configuration

Located in `vitest.workspace.js`:

```javascript
export default defineWorkspace([
  // Core project (Node.js environment)
  {
    test: {
      include: ['core/**/*.test.js', 'tests/**/*.test.js'],
      name: 'core',
      environment: 'node',
      globals: true
    }
  },
  // Website project (jsdom environment)
  './website'
])
```

## Core CLI Testing

### Configuration

**Location**: `vitest.config.js`

```javascript
{
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'website/', 'tests/', 'scripts/']
    }
  }
}
```

### Directory Structure

```
core/__tests__/
├── setup.test.js
├── agentic/
│   ├── command-executor.test.js
│   ├── context-builder.test.js
│   ├── prompt-builder.test.js
│   ├── template-loader.test.js
│   └── tool-registry.test.js
├── domain/
│   └── agent-generator.test.js
└── utils/
    ├── date-helper.test.js
    └── file-helper.test.js
```

### Running Core Tests

```bash
# Run only core tests
npm test -- core

# Watch mode for core
npm run test:watch -- core

# Coverage for core only
npm run test:coverage -- core
```

### Example Core Test

```javascript
import { describe, it, expect } from 'vitest'
import commandExecutor from '../../agentic/command-executor.js'

describe('Command Executor', () => {
  it('should execute command successfully', async () => {
    const result = await commandExecutor.execute('now', {}, projectPath)

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
  })
})
```

## Website Testing

### Configuration

**Location**: `website/vitest.config.ts`

```typescript
{
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.d.ts', '**/*.config.*', 'dist/']
    }
  }
}
```

### Directory Structure

```
website/src/__tests__/
├── setup.test.ts
├── components/
│   ├── Hero.test.tsx
│   ├── Features.test.tsx
│   ├── Terminal.test.tsx
│   ├── Navigation.test.tsx
│   ├── EarlyAccessForm.test.tsx
│   ├── Logo.test.tsx
│   └── ui/
│       ├── Badge.test.tsx
│       ├── Button.test.tsx
│       ├── Card.test.tsx
│       ├── IconBox.test.tsx
│       └── Section.test.tsx
```

### Running Website Tests

```bash
# Install website dependencies first (if not done)
npm run website:install

# Run only website tests
npm --prefix website test

# Watch mode for website
npm --prefix website run test:watch

# Coverage for website only
npm --prefix website run test:coverage
```

### Example React Component Test

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Hero } from '../../components/Hero'

describe('Hero Component', () => {
  it('should render hero section with title', () => {
    render(<Hero />)
    expect(screen.getByText('prjct/')).toBeInTheDocument()
  })

  it('should display install command', () => {
    render(<Hero />)
    expect(screen.getByText(/npm install -g prjct-cli/i)).toBeInTheDocument()
  })
})
```

## Code Coverage

### Viewing Coverage Reports

After running `npm run test:coverage`:

**Core CLI Coverage**:
```bash
# Terminal output shows summary
# Detailed HTML report at: coverage/index.html
open coverage/index.html
```

**Website Coverage**:
```bash
# Detailed HTML report at: website/coverage/index.html
open website/coverage/index.html
```

### Coverage Configuration

Both projects use **V8 coverage provider** with three output formats:

- `text` - Terminal output during test runs
- `json` - Machine-readable format for CI/CD
- `html` - Interactive HTML report for local development

### Coverage Thresholds

Coverage reports exclude:
- `node_modules/`
- Test files and setup
- Configuration files
- Build artifacts

## CI/CD Integration

### GitHub Actions Workflow

**Location**: `.github/workflows/test.yml`

The workflow runs **4 parallel jobs**:

1. **test-core** - Run core CLI tests + generate coverage
2. **test-website** - Run website tests + generate coverage
3. **lint** - ESLint validation
4. **build-website** - Verify website builds successfully

### Workflow Triggers

Tests run automatically on:
- Push to `main` branch
- Pull requests targeting `main`

### Artifacts

Coverage reports are uploaded as artifacts:
- `core-coverage` - Core CLI coverage report
- `website-coverage` - Website coverage report
- `website-build` - Built website files

## Writing Tests

### Best Practices

#### Core CLI Tests

1. **Use descriptive test names**
```javascript
// ✅ Good
it('should execute command successfully')

// ❌ Bad
it('works')
```

2. **Test behavior, not implementation**
```javascript
// ✅ Good
expect(result.success).toBe(true)

// ❌ Bad
expect(result._internalFlag).toBe(true)
```

3. **Group related tests**
```javascript
describe('Command Executor', () => {
  describe('execute()', () => {
    it('should load template')
    it('should build context')
    it('should handle errors')
  })
})
```

#### Website Component Tests

1. **Test user-facing behavior**
```typescript
// ✅ Good
expect(screen.getByText('Install')).toBeInTheDocument()

// ❌ Bad
expect(wrapper.find('.button').length).toBe(1)
```

2. **Use Testing Library queries**
```typescript
// ✅ Good - Semantic queries
screen.getByRole('button', { name: /install/i })
screen.getByLabelText('Email')

// ❌ Bad - Implementation details
document.querySelector('.button-class')
```

3. **Mock external dependencies**
```typescript
import { vi } from 'vitest'

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn() }
  })
})
```

### Test File Naming

- Core: `*.test.js`
- Website: `*.test.tsx` (for components) or `*.test.ts` (for utilities)

### Test Organization

```
__tests__/
├── setup.test.js         # Vitest setup validation
├── [feature]/            # Group by feature
│   └── feature.test.js
└── components/           # Group by type
    └── Component.test.tsx
```

## Troubleshooting

### Common Issues

**"Cannot find module" errors**

```bash
# Make sure dependencies are installed
npm ci
npm run website:install
```

**Tests pass locally but fail in CI**

```bash
# Run tests with same settings as CI
npm test -- --reporter=verbose
npm run test:coverage
```

**Coverage report not generated**

```bash
# Clean coverage directory and regenerate
rm -rf coverage website/coverage
npm run test:coverage
```

**Website tests fail with "document is not defined"**

Check that `vitest.config.ts` has:
```typescript
test: {
  environment: 'jsdom'  // Required for DOM tests
}
```

## Testing Commands Reference

```bash
# All tests (workspace)
npm test                    # Run all tests once
npm run test:watch          # Watch mode for all tests
npm run test:coverage       # Full coverage report

# Core only
npm test -- core                    # Run core tests
npm run test:watch -- core          # Core watch mode
npm run test:coverage -- core       # Core coverage

# Website only
npm --prefix website test                   # Run website tests
npm --prefix website run test:watch         # Website watch mode
npm --prefix website run test:coverage      # Website coverage

# CI/CD validation (run what CI runs)
npm run lint                # Lint all code
npm run website:build       # Verify website builds
npm test -- --reporter=verbose  # Verbose test output
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [Vitest Coverage](https://vitest.dev/guide/coverage.html)

## Need Help?

- Check test examples in `core/__tests__/` and `website/src/__tests__/`
- Review existing test patterns for similar features
- See [CONTRIBUTING.md](docs/Developer-Guide/contributing.md) for development guidelines
- Open an issue at [github.com/jlopezlira/prjct-cli/issues](https://github.com/jlopezlira/prjct-cli/issues)
