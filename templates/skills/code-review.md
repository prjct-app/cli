---
name: Code Review
description: Review code changes for quality, security, and best practices
agent: general
tags: [review, quality, security]
version: 1.0.0
---

# Code Review Skill

Review the provided code changes with focus on:

## Quality Checks
- Code readability and clarity
- Naming conventions
- Function/method length
- Code duplication
- Error handling

## Security Checks
- Input validation
- SQL injection risks
- XSS vulnerabilities
- Sensitive data exposure
- Authentication/authorization issues

## Best Practices
- SOLID principles
- DRY (Don't Repeat Yourself)
- Single responsibility
- Proper typing (TypeScript)
- Documentation where needed

## Output Format

Provide feedback in this structure:

### Summary
Brief overview of the changes

### Issues Found
- 🔴 **Critical**: Must fix before merge
- 🟡 **Warning**: Should fix, but not blocking
- 🔵 **Suggestion**: Nice to have improvements

### Recommendations
Specific actionable items to improve the code
