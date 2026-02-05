---
allowed-tools: [Bash, Read, Write]
---

# p. test

## Step 1: Detect Test Runner

Check project files to determine the test runner:

```bash
# Check for package.json with test script
if [ -f package.json ]; then
  cat package.json | grep -o '"test"[[:space:]]*:' && echo "node"
fi

# Check for pytest
if [ -f pytest.ini ] || [ -f pyproject.toml ]; then
  echo "pytest"
fi

# Check for Cargo (Rust)
if [ -f Cargo.toml ]; then
  echo "cargo"
fi

# Check for Go
if [ -f go.mod ]; then
  echo "go"
fi

# Check for .NET
if ls *.sln *.csproj 2>/dev/null | head -1; then
  echo "dotnet"
fi
```

| Detected | Runner Command |
|----------|----------------|
| package.json with scripts.test | `npm test` or `bun test` or `pnpm test` |
| pytest.ini / pyproject.toml | `pytest` |
| Cargo.toml | `cargo test` |
| go.mod | `go test ./...` |
| *.sln / *.csproj | `dotnet test` |

## Step 2: Run Tests

```bash
{runnerCmd} 2>&1
```

Parse results to count passed/failed tests.

## Step 3: Handle Results

**IF all tests pass:**

```
✅ Tests passing

Passed: {count}
Coverage: {%} (if available)

Next:
- Code review → `p. review`
- Ship → `p. ship`
```

**IF tests fail:**

```
❌ {failed} tests failing

{test output - last 50 lines}

Next:
- Auto-fix snapshots → `p. test fix`
- Fix manually and re-run
```

---

## Fix Mode (`p. test fix`)

IF mode == "fix":
  Try updating snapshots:
  ```bash
  {runnerCmd} -- -u
  # or for jest: npm test -- -u
  # or for vitest: npx vitest --update
  ```

  Re-run tests to verify fix.
