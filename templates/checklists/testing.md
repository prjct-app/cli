# Testing Checklist

> Applies to: Unit, Integration, E2E, Performance testing

## Coverage Strategy
- [ ] Critical paths have high coverage
- [ ] Happy path tested
- [ ] Error paths tested
- [ ] Edge cases covered

## Test Quality
- [ ] Tests are deterministic (no flaky tests)
- [ ] Tests are independent (no order dependency)
- [ ] Tests are fast (optimize slow tests)
- [ ] Tests are readable (clear intent)

## Test Types
- [ ] Unit tests for business logic
- [ ] Integration tests for boundaries
- [ ] E2E tests for critical flows
- [ ] Performance tests for bottlenecks

## Mocking Strategy
- [ ] External services mocked
- [ ] Database isolated or mocked
- [ ] Time-dependent code controlled
- [ ] Random values seeded

## Test Maintenance
- [ ] Tests updated with code changes
- [ ] Dead tests removed
- [ ] Test data managed properly
- [ ] CI/CD integration working
