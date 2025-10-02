---
allowed-tools: [Read, Grep, Glob, Bash, TodoWrite]
description: "Analyze current repository and generate comprehensive project summary"
---

## Global Architecture
This command uses the global prjct architecture:
- Data stored in: `~/.prjct-cli/projects/{id}/`
- Config stored in: `{project}/.prjct/prjct.config.json`
- Commands synchronized across all editors

## Agent Workflow
This command activates the AI agent workflow for comprehensive project analysis. When you run `/p:analyze`, you as the AI agent should follow the complete workflow instructions below to provide deep analysis of the codebase.



# /p:analyze - Repository Analysis

## Purpose
Automatically analyze the current codebase and generate a comprehensive summary of the repository including technologies, architecture, and project structure.

## Usage
```
/p:analyze
```

## Execution
1. **Scan project structure** - Analyze directories and file types
2. **Identify technologies** - Detect frameworks, languages, tools
3. **Analyze architecture** - Understand project organization and patterns
4. **Git integration** - Validate repository state against claims
5. **Detect required agents** - Determine which specialists are needed
6. **Generate summary** - Create detailed analysis report
7. **Save to analysis** - Store results in `.prjct/analysis/repo-summary.md`

## Implementation

When this command is triggered:

1. **Create analysis directory**:
   ```bash
   mkdir -p .prjct/analysis
   ```

2. **Scan project structure**:
   - Use Glob to find all files and directories
   - Identify main directories (src, lib, components, etc.)
   - Count files by type (.js, .ts, .py, .go, etc.)

3. **Technology detection**:
   - Check package.json for JavaScript/Node.js projects
   - Check requirements.txt, Pipfile for Python projects
   - Check go.mod for Go projects
   - Check Cargo.toml for Rust projects
   - Detect frameworks (React, Vue, Angular, Express, FastAPI, etc.)

4. **Architecture analysis**:
   - Identify entry points (main.js, app.py, main.go)
   - Analyze import/require patterns
   - Detect architectural patterns (MVC, microservices, monolith)
   - Identify configuration files

5. **Generate comprehensive report**:
   ```markdown
   # Repository Analysis Report

   ## Project Overview
   - **Name**: [Detected from package.json or directory name]
   - **Type**: [Web app, Library, CLI tool, etc.]
   - **Primary Language**: [JavaScript, Python, Go, etc.]
   - **Framework**: [React, Express, FastAPI, etc.]

   ## Structure Analysis
   - **Total Files**: [count]
   - **Main Directories**: [list]
   - **Entry Points**: [main files]

   ## Technologies Detected
   - **Languages**: [list with percentages]
   - **Frameworks**: [list]
   - **Tools**: [build tools, testing, etc.]
   - **Dependencies**: [key dependencies]

   ## Architecture
   - **Pattern**: [MVC, Component-based, etc.]
   - **File Organization**: [description]
   - **Key Components**: [main modules/components]

   ## Recommendations
   - [Suggestions for improvements]
   - [Best practices to consider]

   **Generated**: [timestamp]
   ```

6. **Save analysis**:
   Write the complete analysis to `.prjct/analysis/repo-summary.md`

7. **Provide summary**:
   Display key findings and next suggested actions

## Example Workflow

```bash
# Run analysis
/p:analyze

# Results saved to:
# .prjct/analysis/repo-summary.md

# Example output:
🔍 **Repository Analysis Complete**

**Project**: prjct-cli (CLI Tool)
**Language**: JavaScript (Node.js)
**Structure**: 45 files across 8 directories
**Dependencies**: 12 packages detected

📄 **Full report**: `.prjct/analysis/repo-summary.md`

**Next steps**:
- `/p:roadmap` - Plan development roadmap
- `/p:now "implement feature X"` - Set current focus
```

## Git Integration

When analyzing the repository, also integrate git information:

1. **Check if git repository**:
   ```javascript
   const gitIntegration = require('../core/git-integration')
   const isGit = await gitIntegration.isGitRepo()
   ```

2. **Get git statistics**:
   ```javascript
   const gitStats = await gitIntegration.getGitStats()
   ```

3. **Include in analysis report**:
   - Last commit information
   - Working directory status
   - Total commits
   - Contributors
   - Branch information

4. **Validation baseline**:
   - Last commit = source of truth
   - Working directory changes = unverified work
   - Use for validating user claims later

## Agent Detection

Based on the project analysis, determine which AI agents should be generated:

### Base Agents (Always)
- **PM**: Project Manager - Always needed
- **UX**: UX Designer - Always needed
- **FE**: Frontend Engineer - Always needed
- **BE**: Backend Engineer - Always needed
- **QA**: QA Engineer - Always needed
- **Scribe**: Documentation - Always needed

### Conditional Agents

**Security Agent** - Generate if:
- Project type is 'web' or 'webapp'
- Authentication detected (JWT, OAuth, sessions)
- Has API endpoints
- Security-sensitive data handling

**DevOps Agent** - Generate if:
- Dockerfile or docker-compose.yml found
- Kubernetes configs found (k8s/, *.yaml with apiVersion)
- CI/CD configs (`.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`)
- Deployment scripts detected

**Mobile Agent** - Generate if:
- React Native detected (`react-native` in package.json)
- Flutter detected (`pubspec.yaml`)
- Expo detected (`expo` in package.json)
- Ionic detected (`@ionic` in package.json)

**Data Science Agent** - Generate if:
- ML libraries (`tensorflow`, `pytorch`, `scikit-learn`)
- Data libraries (`pandas`, `numpy`)
- Jupyter notebooks (`.ipynb` files)
- Data pipeline files

## Updated Analysis Report Format

```markdown
# Repository Analysis Report

**Generated**: [timestamp]
**Project**: [name]

## Project Overview
- **Type**: [Web app, CLI tool, Library, etc.]
- **Primary Language**: [JavaScript, Python, Go, etc.]
- **Framework**: [React, Express, FastAPI, etc.]

## Git Status
- **Repository**: [Yes/No]
- **Last Commit**: [hash] "[message]" ([time ago])
- **Author**: [name]
- **Total Commits**: [count]
- **Contributors**: [list]
- **Current Branch**: [branch name]

## Working Directory
- **Status**: [Clean / Has changes]
- **Modified Files**: [count]
- **New Files**: [count]
- **Deleted Files**: [count]

⚠️ **Validation Note**: Last commit is the source of truth. Use this to validate user claims about completed work.

## Stack Detection
- **Languages**: [list with file counts]
- **Frameworks**: [list]
- **Build Tools**: [Vite, Webpack, etc.]
- **Package Manager**: [npm, yarn, pnpm, pip, etc.]
- **Dependencies**: [count] packages

## Architecture
- **Pattern**: [MVC, Feature-based, Microservices, etc.]
- **Structure**: [description of directory organization]
- **Entry Points**: [main files]
- **Key Directories**: [list]

## Recommended Agents
✅ **Base Agents** (6): PM, UX, FE, BE, QA, Scribe
✅ **Additional Agents**: [List conditional agents with reason]

Example:
- Security (web app with authentication detected)
- DevOps (Docker + GitHub Actions found)

## Analysis Details
- **Total Files**: [count]
- **Code Files**: [count]
- **Test Files**: [count]
- **Config Files**: [count]

## Next Steps
1. Run `/p:init` to generate agents based on this analysis
2. Use `/p:now "task"` to start working
3. Use `/p:sync` to update agents when stack changes
```

## Error Handling
- Handle projects without clear package managers
- Gracefully handle large repositories (>1000 files)
- Provide meaningful analysis even for minimal projects
- Skip binary files and common ignore patterns
- Handle non-git repositories (skip git section)
- Handle repositories without commits (note in report)