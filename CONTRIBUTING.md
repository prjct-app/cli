# Contributing to prjct-cli

Thank you for your interest in contributing to prjct-cli! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/jlopezlira/prjct-cli/issues)
2. If not, create a new issue with:
   - Clear title describing the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, prjct version)

### Suggesting Features

1. Check existing [Issues](https://github.com/jlopezlira/prjct-cli/issues) for similar suggestions
2. Create a new issue with the `enhancement` label
3. Describe the use case and proposed solution

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run tests: `bun test`
5. Run linting: `bun run check`
6. Commit with conventional commits: `feat: add feature` or `fix: fix bug`
7. Push and create a Pull Request

## Development Setup

```bash
# Clone the repository
git clone https://github.com/jlopezlira/prjct-cli.git
cd prjct-cli

# Install dependencies
bun install

# Run tests
bun test

# Run linting
bun run check

# Build
bun run build
```

## Project Structure

```
prjct-cli/
├── core/           # Core library code
│   ├── commands/   # CLI command handlers
│   ├── services/   # Business logic services
│   ├── types/      # TypeScript type definitions
│   └── utils/      # Utility functions
├── templates/      # Command and context templates
├── bin/            # CLI entry point
└── scripts/        # Build and deploy scripts
```

## Coding Standards

- TypeScript with strict mode
- Biome for linting and formatting
- Conventional commits for commit messages
- Tests for new features and bug fixes

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Build/tooling changes

## Questions?

Feel free to open an issue or reach out to the maintainers.
