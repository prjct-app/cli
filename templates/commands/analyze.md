---
allowed-tools: [Read, Grep, Glob, Bash, TodoWrite]
description: "Analyze current repository and generate comprehensive project summary"
---

## Global Architecture
This command uses the global prjct architecture:
- Data stored in: `~/.prjct-cli/projects/{id}/`
- Config stored in: `{project}/.prjct/prjct.config.json`
- Commands synchronized across all editors



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
4. **Generate summary** - Create detailed analysis report
5. **Save to analysis** - Store results in `.prjct/analysis/repo-summary.md`

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

## Error Handling
- Handle projects without clear package managers
- Gracefully handle large repositories (>1000 files)
- Provide meaningful analysis even for minimal projects
- Skip binary files and common ignore patterns