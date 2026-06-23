# prjct evals

`prjct eval` is the product-evaluation harness for proving whether prjct-cli gets better or worse between versions. It is deterministic by default, local-first, and publishable to GitHub.

## Commands

```bash
prjct eval run --candidate 2.62.0
prjct eval report --md
prjct eval compare --baseline 2.61.0 --candidate 2.62.0 --md
prjct eval run --candidate "$GITHUB_SHA" --publish --target github
prjct eval compare --baseline "$BASELINE" --candidate "$CANDIDATE" --publish --target github
```

## Local storage

Runs and comparisons are written under:

```text
$PRJCT_CLI_HOME/evals/<owner-repo-or-local-hash>/
  latest.json
  latest-comparison.json
  runs/<runId>.json
  runs/<runId>.md
  comparisons/<comparisonId>.json
  comparisons/<comparisonId>.md
```

The JSON files are the source of truth. Markdown exists so humans can review the same evidence quickly.

## GitHub publishing

Publishing uses the GitHub CLI and writes to an `eval-results` branch:

```text
eval-results/
  runs/YYYY-MM-DD/<runId>.json
  runs/YYYY-MM-DD/<runId>.md
  comparisons/YYYY-MM-DD/<comparisonId>.json
  comparisons/YYYY-MM-DD/<comparisonId>.md
  summary/latest.json
  summary/latest-comparison.json
```

Every scenario and comparison carries actionables. Regressions are blocking actionables; improvements and unchanged scenarios still tell maintainers what to protect or keep measuring.

## CI workflow

This repo includes `.github/workflows/prjct-evals.yml` with manual inputs:

- `candidate`: label to store as the candidate version; defaults to the commit SHA.
- `baseline`: optional baseline label to compare against.
- `publish`: when true, writes results to the `eval-results` branch.

The workflow always uploads local eval artifacts to GitHub Actions, even when branch publishing is disabled.
