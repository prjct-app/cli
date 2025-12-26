---
name: Debug
description: Systematic debugging to find and fix issues
agent: general
tags: [debug, fix, troubleshoot]
version: 1.0.0
---

# Debug Skill

Systematically debug the reported issue.

## Process

### Step 1: Understand the Problem
- What is the expected behavior?
- What is the actual behavior?
- When did it start happening?
- Can it be reproduced consistently?

### Step 2: Gather Information
- Read relevant error messages
- Check logs
- Review recent changes
- Identify affected code paths

### Step 3: Form Hypothesis
- What could cause this behavior?
- List possible causes in order of likelihood
- Identify the most likely root cause

### Step 4: Test Hypothesis
- Add logging if needed
- Isolate the problematic code
- Verify the root cause

### Step 5: Fix
- Implement the minimal fix
- Ensure no side effects
- Add tests if applicable

### Step 6: Verify
- Confirm the issue is resolved
- Check for regressions
- Document the fix

## Output Format

```
## Issue
[Description of the problem]

## Root Cause
[What was causing the issue]

## Fix
[What was changed to fix it]

## Prevention
[How to prevent similar issues]
```
