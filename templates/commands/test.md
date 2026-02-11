---
allowed-tools: [Bash, Read]
---

# p. test $ARGUMENTS

## Step 1: Run tests
```bash
prjct test $ARGUMENTS --md
```

If the CLI doesn't handle testing directly, detect and run:
- Node: `npm test` or `bun test`
- Python: `pytest`
- Rust: `cargo test`
- Go: `go test ./...`

## Step 2: Report results
Show pass/fail counts. If tests fail, show the relevant output.

## Fix mode (`p. test fix`)
Update test snapshots and re-run to verify.
