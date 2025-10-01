---
title: prjct analyze
invocable_name: p:analyze
description: Generate or update repository analysis using global prjct architecture
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` and `author` from config
3. Analyze project structure:
   - File tree and organization
   - Package dependencies
   - Framework detection
   - Code patterns and conventions
4. Analyze technical stack:
   - Languages and versions
   - Frameworks and libraries
   - Build tools and scripts
   - Testing setup
5. Identify key components:
   - Entry points
   - Core modules
   - API endpoints
   - UI components
6. Assess project health:
   - Code quality indicators
   - Test coverage
   - Documentation coverage
   - Technical debt
7. Generate or update analysis file: `~/.prjct-cli/projects/{projectId}/analysis/repo-summary.md`
8. Update project context: `~/.prjct-cli/projects/{projectId}/core/context.md`
9. Log analysis to memory
10. Display summary and insights

# Response Format

```
🔍 Repository Analysis Complete

## Project Overview
- Name: {project-name}
- Type: {app-type}
- Primary Language: {language}
- Framework: {framework}

## Technical Stack
**Languages**: {languages with percentages}
**Frameworks**: {frameworks and versions}
**Key Dependencies**:
- {dep 1} ({version})
- {dep 2} ({version})
- {dep 3} ({version})

## Project Structure
{directory-tree-summary}

## Key Components
- **Entry Points**: {files}
- **Core Modules**: {modules}
- **API Layer**: {endpoints-count} endpoints
- **UI Components**: {components-count} components
- **Tests**: {tests-count} test files

## Code Patterns
- Architecture: {pattern} (e.g., MVC, Clean, Microservices)
- State Management: {approach}
- API Style: {REST/GraphQL/gRPC}
- Error Handling: {pattern}

## Project Health
- Code Quality: {score/10}
- Test Coverage: {X}%
- Documentation: {Good/Fair/Needs Improvement}
- Technical Debt: {Low/Medium/High}

## Insights
{key-insights-from-analysis}

## Recommendations
1. {recommendation-1}
2. {recommendation-2}
3. {recommendation-3}

📄 Full analysis saved to: ~/.prjct-cli/projects/{id}/analysis/repo-summary.md

Use /p:context to see how this integrates with your workflow
```

# Analysis Depth

**Quick Analysis** (default):
- File structure scan
- Package.json/requirements parsing
- Framework detection
- Basic metrics

**Deep Analysis** (optional):
- Code complexity analysis
- Dependency graph
- Test coverage calculation
- Documentation audit
- Security scan

# Framework Detection

Auto-detect:
- **Frontend**: React, Vue, Angular, Svelte, Next.js
- **Backend**: Express, Fastify, NestJS, Django, Flask
- **Mobile**: React Native, Flutter, Swift, Kotlin
- **Desktop**: Electron, Tauri
- **Database**: PostgreSQL, MongoDB, Redis, MySQL

# Analysis File Structure

```markdown
# Repository Analysis - {date}

## Overview
{summary}

## Stack
{detailed-stack-info}

## Architecture
{architectural-patterns}

## Dependencies
{dependency-analysis}

## Code Organization
{structure-details}

## Quality Metrics
{metrics-and-scores}

## Recommendations
{actionable-improvements}

## Change Log
- {date}: Initial analysis
- {date}: Updated after refactoring
```

# Integration with Workflow

Analysis helps with:
- `/p:stuck` - Provides technical context for help
- `/p:task` - Informs task breakdown based on architecture
- `/p:roadmap` - Aligns roadmap with technical reality
- `/p:now` - Better task context awareness

# Global Architecture Notes

- **Analysis Location**: `~/.prjct-cli/projects/{id}/analysis/repo-summary.md`
- **Context Update**: `~/.prjct-cli/projects/{id}/core/context.md`
- **Memory Logging**: `~/.prjct-cli/projects/{id}/memory/context.jsonl`
- **Config Location**: `{project}/.prjct/prjct.config.json`
- **Use Case**: Onboarding, debugging, refactoring, planning
