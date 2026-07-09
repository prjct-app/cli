#!/usr/bin/env bun
/**
 * Public demo CLI: weak model + prjct vs frontier without harness.
 * Logic lives in core/services/weak-frontier-demo.ts (tested).
 *
 * Usage: bun scripts/demo-weak-vs-frontier.ts
 */

import { buildDemoRows, formatDemoMarkdown } from '../core/services/weak-frontier-demo'

const rows = buildDemoRows()
console.log(formatDemoMarkdown(rows))
const failed = rows.filter((r) => !r.weakOk)
process.exit(failed.length === 0 ? 0 : 1)
