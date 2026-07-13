---
name: systematic-debugging
description: Use when encountering flaky tests, race conditions, hanging processes, inconsistent behavior, or any bug that resists obvious fixes. Especially when under time pressure or after initial guesses fail.
---

# Systematic Debugging

## Overview
**Systematic debugging is root-cause analysis, not guess-and-check.** It follows a repeatable 4-phase process to eliminate assumptions, reproduce the failure reliably, isolate the exact cause, and verify the fix. **Always pair with test-driven-development and verification-before-completion.**

**Core principle:** "If you didn't reproduce it reliably and isolate the root cause, you haven't fixed it — you've just hidden it."

## When to Use
- Bug appears intermittently (flaky tests, race conditions).
- "It worked on my machine" or environment-specific failures.
- Initial obvious fixes don't stick (regression appears later).
- Debugging loops > 15 minutes or multiple failed guesses.
- **NEVER** for syntax errors or obvious typos (use compiler/linter first).

**Do NOT use** for:
- Known issues already documented in `prjct context memory`.
- Features that need redesign (use `design` first).

## Core Procedure (4 Phases - Follow Strictly)
1. **Reproduce (RED)**  
   Create a minimal, reliable reproduction (test case or script). Document exact steps, inputs, environment.  
   *Pressure test:* Run 10x in CI-like conditions. Capture logs, stack traces, metrics.

2. **Isolate (Binary Search)**  
   Divide and conquer: comment out halves of code, use git bisect, or binary search on commits/variables.  
   Ask: "What is the smallest change that triggers the failure?"

3. **Root Cause (Why-Why-Why)**  
   Apply 5-Whys + defense-in-depth. Identify the exact faulty assumption (e.g. "assumed network always available").  
   Document rationalizations avoided (see rationalization table below).

4. **Verify & Prevent (GREEN + Refactor)**  
   - Write/regress test that would have caught it (TDD style).
   - Add guard/assert/precondition.
   - Run full test suite + `prjct review-risk`.
   - Update memory: `prjct remember gotcha "..." --tags bug:root-cause`.
   - **Delete** any temporary debug code.

**Rationalization Table (Common Excuses & Counters)**
| Excuse | Reality |
|--------|---------|
| "It works on my machine" | Environment matters. Reproduce in clean CI/worktree. |
| "Just add a sleep/retry" | Hides race conditions. Fix root cause (locks, ordering). |
| "Too complex to bisect" | Reduce first (`prjct lean`). Smallest repro is mandatory. |
| "I'll fix it later" | Creates tech debt. Ship only verified fixes. |
| "It's a dependency bug" | Verify by pinning versions or mocking. |

**Red Flags (STOP if you see these)**
- Guessing without reproduction.
- Changing multiple things at once.
- "It seems to work now".
- Ignoring logs/metrics.
- Adding debug prints without removing them.

## Quick Reference
- **Reproduce:** Minimal test + CI conditions.
- **Tools:** `prjct guard <file>`, logs, debugger, `git bisect`, prjct domain analyzers.
- **Verification:** New test + full suite + `prjct ship` gate.
- **Memory:** Always `prjct remember gotcha` or `learning` with root cause.

## Common Mistakes
- Treating symptoms (adding retries) instead of root cause.
- Not updating tests/memory after fix (leads to regression).
- Skipping reproduction in clean environment.
- Over-debugging without binary search (wastes time).

**TDD for this skill itself:** Baseline test any new debugging scenario WITHOUT this skill first.

Follow the procedure — no exceptions.
