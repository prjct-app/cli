# Dispute: OSV MAL-2026-4647 (false positive)

> **Status (2026-06-20): FILED** — [ossf/malicious-packages#1324](https://github.com/ossf/malicious-packages/issues/1324),
> requesting the whole report be moved to `./osv/withdrawn/`. Awaiting maintainer action.
> Remaining (not CLI-doable): request reclassification with Amazon Inspector (the upstream source) via AWS.

**Advisory:** https://osv.dev/vulnerability/MAL-2026-4647 — "Malicious code in prjct-cli (npm)"
**Affected version (per advisory):** `prjct-cli@2.21.0` only
**Source:** Amazon Inspector ("alternate-runtime-dropper" heuristic)
**Our position:** false positive — it flagged the project's **own, documented Bun installer**, not
injected third-party malware. The flagged behavior was already removed and is now gone entirely.

## Why it is a false positive

The heuristic fired on `prjct-cli`'s own optional Bun-runtime bootstrap:

- In `2.21.0`, `scripts/postinstall.js` invoked `scripts/ensure-bun.sh`, which ran the **official**
  Bun installer `curl -fsSL https://bun.sh/install | bash`. This is first-party project code,
  committed in the public repo (https://github.com/jlopezlira/prjct-cli) and visible in the package
  — not obfuscated, not exfiltrating data, not injected. It is the same one-line installer Bun
  documents at https://bun.sh. No network beacon, no credential access, no hidden payload.
- The classification ("alternate-runtime-dropper") is a generic pattern match on
  "postinstall → curl | bash → run package with the downloaded runtime", not evidence of malice.

## Why it no longer applies to current versions

- The **install-time** invocation was removed in PR #391 ("drop better-sqlite3 — zero native deps,
  no postinstall"). Since then `package.json` has **no `postinstall`/`preinstall`/`install` hook** —
  `npm install prjct-cli` executes nothing.
- As of **2.50.1** the Bun auto-installer is **removed entirely**: `scripts/ensure-bun.sh` is deleted,
  dropped from the published `files[]`, and `bin/prjct` no longer invokes it (it falls back to Node).
  The published package now ships **zero `curl | bash`**.
- The advisory itself pins only `2.21.0`; no current version matches.

## Requested action

1. **Withdraw / mark false-positive** in the OSV malicious-packages dataset
   (https://github.com/ossf/malicious-packages) via a withdrawal/false-positive PR citing this file,
   PR #391 (postinstall removal), and 2.50.1 (full removal).
2. **Reclassify with Amazon Inspector** (the upstream source) so the finding stops propagating to
   downstream scanners (Snyk, GitHub Advisory, `npm audit`).

## Evidence links

- Public repo: https://github.com/jlopezlira/prjct-cli
- Postinstall removal: PR #391 (`de06bba`)
- Full installer removal: CHANGELOG 2.50.1
- Bun's own installer (the flagged command): https://bun.sh
