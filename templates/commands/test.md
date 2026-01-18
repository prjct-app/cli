---
allowed-tools: [Bash, Read, Write]
---

# p. test

```bash
prjct context test
```

Detect test runner from project files:
- package.json with scripts.test → npm/pnpm/yarn/bun test
- pytest.ini/pyproject.toml → pytest
- Cargo.toml → cargo test
- go.mod → go test ./...
- *.sln/*.csproj → dotnet test

Run tests:
```bash
{runnerCmd} 2>&1
```

Parse results: passed/failed count

IF failed AND mode == "fix":
  Try `{runnerCmd} -- -u` (update snapshots)
  Re-run tests

**Output (pass)**:
```
✅ Tests passing

Passed: {count}
Coverage: {%}

Next:
- Code review → `p. review`
- Ship → `p. ship`
```

**Output (fail)**:
```
❌ {failed} tests failing

{test output}

Next:
- Auto-fix → `p. test fix`
- Fix manually and re-run
```
