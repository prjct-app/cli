const fs = require('fs').promises
const path = require('path')
const { promisify } = require('util')
const { exec: execCallback } = require('child_process')
const exec = promisify(execCallback)

/**
 * CodebaseAnalyzer - Analyzes existing code to sync with .prjct/ state
 *
 * Detects:
 * - Implemented commands in bin/prjct and core/commands.js
 * - Completed features from git history and file structure
 * - Project structure and technologies
 *
 * Syncs with:
 * - next.md (marks completed tasks)
 * - shipped.md (adds detected features)
 * - analysis/repo-summary.md (creates detailed report)
 */
class CodebaseAnalyzer {
  constructor() {
    this.projectPath = null
    this.analysis = null
  }

  /**
   * Main analysis entry point
   */
  async analyzeProject(projectPath = process.cwd()) {
    this.projectPath = projectPath

    this.analysis = {
      commands: await this.detectImplementedCommands(),
      features: await this.detectCompletedFeatures(),
      structure: await this.detectProjectStructure(),
      gitHistory: await this.scanGitHistory(),
      technologies: await this.detectTechnologies()
    }

    return this.analysis
  }

  /**
   * Detect implemented commands in bin/prjct
   */
  async detectImplementedCommands() {
    const commands = []

    try {
      const binPath = path.join(this.projectPath, 'bin', 'prjct')
      const content = await fs.readFile(binPath, 'utf-8')

      const caseMatches = content.matchAll(/case\s+'([^']+)':/g)
      for (const match of caseMatches) {
        commands.push(match[1])
      }

      const commandsPath = path.join(this.projectPath, 'core', 'commands.js')
      if (await this.fileExists(commandsPath)) {
        const commandsContent = await fs.readFile(commandsPath, 'utf-8')
        const methodMatches = commandsContent.matchAll(/async\s+(\w+)\s*\(/g)

        for (const match of methodMatches) {
          const methodName = match[1]
          if (!methodName.startsWith('_') &&
              methodName !== 'constructor' &&
              methodName !== 'initializeAgent' &&
              !commands.includes(methodName)) {
            commands.push(methodName)
          }
        }
      }
    } catch (error) {
      console.error('[analyzer] Error detecting commands:', error.message)
    }

    return commands
  }

  /**
   * Detect completed features from various sources
   */
  async detectCompletedFeatures() {
    const features = []

    const gitFeatures = await this.extractFeaturesFromGit()
    features.push(...gitFeatures)

    const packageFeatures = await this.extractFeaturesFromPackageJson()
    features.push(...packageFeatures)

    const structureFeatures = await this.extractFeaturesFromStructure()
    features.push(...structureFeatures)

    return [...new Set(features)]
  }

  /**
   * Extract features from git commit history
   */
  async extractFeaturesFromGit() {
    const features = []

    try {
      const { stdout } = await exec(
        'git log --all --pretty=format:"%s" --grep="^feat:" --grep="^ship:" --grep="^feature:" -i',
        { cwd: this.projectPath }
      )

      if (stdout) {
        const commits = stdout.split('\n')
        for (const commit of commits) {
          const match = commit.match(/^(?:feat|ship|feature):\s*(.+)/i)
          if (match) {
            features.push(match[1].trim())
          }
        }
      }
    } catch (error) {
    }

    return features
  }

  /**
   * Extract features from package.json dependencies
   */
  async extractFeaturesFromPackageJson() {
    const features = []

    try {
      const packagePath = path.join(this.projectPath, 'package.json')
      const content = await fs.readFile(packagePath, 'utf-8')
      const pkg = JSON.parse(content)

      const deps = { ...pkg.dependencies, ...pkg.devDependencies }

      const featureMap = {
        'express': 'REST API server',
        'next': 'Next.js application',
        'react': 'React frontend',
        'vue': 'Vue application',
        'typescript': 'TypeScript support',
        'jest': 'Testing framework',
        'prisma': 'Database ORM',
        'mongoose': 'MongoDB integration',
        'stripe': 'Payment processing',
        'passport': 'Authentication system'
      }

      for (const [dep, feature] of Object.entries(featureMap)) {
        if (deps[dep]) {
          features.push(feature)
        }
      }
    } catch (error) {
    }

    return features
  }

  /**
   * Extract features from directory structure
   */
  async extractFeaturesFromStructure() {
    const features = []

    try {
      const entries = await fs.readdir(this.projectPath, { withFileTypes: true })

      const featureDirs = {
        'auth': 'Authentication system',
        'api': 'API endpoints',
        'admin': 'Admin panel',
        'dashboard': 'Dashboard interface',
        'payment': 'Payment integration',
        'notifications': 'Notification system',
        'chat': 'Chat functionality',
        'search': 'Search feature',
        'analytics': 'Analytics tracking'
      }

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirName = entry.name.toLowerCase()
          if (featureDirs[dirName]) {
            features.push(featureDirs[dirName])
          }
        }
      }
    } catch (error) {
    }

    return features
  }

  /**
   * Detect project structure and organization
   */
  async detectProjectStructure() {
    const structure = {
      hasTests: false,
      hasDocs: false,
      hasCI: false,
      fileCount: 0,
      directories: []
    }

    try {
      const entries = await fs.readdir(this.projectPath, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory()) {
          structure.directories.push(entry.name)

          if (entry.name === 'test' || entry.name === 'tests' || entry.name === '__tests__') {
            structure.hasTests = true
          }
          if (entry.name === 'docs' || entry.name === 'documentation') {
            structure.hasDocs = true
          }
        }
      }

      const ciFiles = ['.github/workflows', '.gitlab-ci.yml', 'jenkins', '.circleci']
      for (const ciFile of ciFiles) {
        if (await this.fileExists(path.join(this.projectPath, ciFile))) {
          structure.hasCI = true
          break
        }
      }

      structure.fileCount = await this.countFiles(this.projectPath)

    } catch (error) {
    }

    return structure
  }

  /**
   * Scan git history for insights
   */
  async scanGitHistory() {
    const history = {
      totalCommits: 0,
      contributors: [],
      firstCommit: null,
      lastCommit: null,
      hasGit: false
    }

    try {
      await exec('git rev-parse --git-dir', { cwd: this.projectPath })
      history.hasGit = true

      const { stdout: countOut } = await exec('git rev-list --count HEAD', { cwd: this.projectPath })
      history.totalCommits = parseInt(countOut.trim()) || 0

      const { stdout: contributorsOut } = await exec(
        'git log --format="%an" | sort -u',
        { cwd: this.projectPath }
      )
      history.contributors = contributorsOut.trim().split('\n').filter(Boolean)

      const { stdout: firstOut } = await exec(
        'git log --reverse --format="%ai" --max-count=1',
        { cwd: this.projectPath }
      )
      history.firstCommit = firstOut.trim()

      const { stdout: lastOut } = await exec(
        'git log --format="%ai" --max-count=1',
        { cwd: this.projectPath }
      )
      history.lastCommit = lastOut.trim()

    } catch (error) {
      history.hasGit = false
    }

    return history
  }

  /**
   * Detect technologies used in the project
   */
  async detectTechnologies() {
    const technologies = []

    try {
      const packagePath = path.join(this.projectPath, 'package.json')
      if (await this.fileExists(packagePath)) {
        const content = await fs.readFile(packagePath, 'utf-8')
        const pkg = JSON.parse(content)

        technologies.push('Node.js')

        const deps = { ...pkg.dependencies, ...pkg.devDependencies }

        if (deps['typescript']) technologies.push('TypeScript')
        if (deps['react']) technologies.push('React')
        if (deps['next']) technologies.push('Next.js')
        if (deps['vue']) technologies.push('Vue.js')
        if (deps['express']) technologies.push('Express')
        if (deps['fastify']) technologies.push('Fastify')
      }

      const entries = await fs.readdir(this.projectPath)

      if (entries.some(f => f.endsWith('.py'))) technologies.push('Python')
      if (entries.some(f => f.endsWith('.go'))) technologies.push('Go')
      if (entries.some(f => f.endsWith('.rs'))) technologies.push('Rust')
      if (entries.some(f => f.endsWith('.rb'))) technologies.push('Ruby')
      if (entries.some(f => f.endsWith('.java'))) technologies.push('Java')

    } catch (error) {
    }

    return [...new Set(technologies)]
  }

  /**
   * Sync analysis results with .prjct/ files
   */
  async syncWithPrjctFiles(globalProjectPath) {
    const syncResults = {
      nextMdUpdated: false,
      shippedMdUpdated: false,
      tasksMarkedComplete: 0,
      featuresAdded: 0
    }

    try {
      syncResults.tasksMarkedComplete = await this.updateNextMd(globalProjectPath)
      if (syncResults.tasksMarkedComplete > 0) {
        syncResults.nextMdUpdated = true
      }

      syncResults.featuresAdded = await this.updateShippedMd(globalProjectPath)
      if (syncResults.featuresAdded > 0) {
        syncResults.shippedMdUpdated = true
      }

      await this.createAnalysisReport(globalProjectPath)

    } catch (error) {
      console.error('[analyzer] Error syncing with .prjct files:', error.message)
    }

    return syncResults
  }

  /**
   * Update next.md by marking completed tasks
   */
  async updateNextMd(globalProjectPath) {
    let tasksMarkedComplete = 0

    try {
      const nextPath = path.join(globalProjectPath, 'core', 'next.md')

      if (!(await this.fileExists(nextPath))) {
        return 0
      }

      let content = await fs.readFile(nextPath, 'utf-8')
      const lines = content.split('\n')
      const implementedCommands = this.analysis.commands.map(c => c.toLowerCase())

      let modified = false
      const newLines = []

      for (const line of lines) {
        if (line.startsWith('- ') && !line.includes('✅')) {
          const taskText = line.substring(2).toLowerCase()

          const isImplemented = implementedCommands.some(cmd =>
            taskText.includes(cmd) || taskText.includes(`/p:${cmd}`)
          )

          if (isImplemented) {
            newLines.push(line.replace('- ', '- ✅ ') + ' _(auto-detected)_')
            tasksMarkedComplete++
            modified = true
          } else {
            newLines.push(line)
          }
        } else {
          newLines.push(line)
        }
      }

      if (modified) {
        await fs.writeFile(nextPath, newLines.join('\n'), 'utf-8')
      }

    } catch (error) {
      console.error('[analyzer] Error updating next.md:', error.message)
    }

    return tasksMarkedComplete
  }

  /**
   * Update shipped.md with detected features
   */
  async updateShippedMd(globalProjectPath) {
    let featuresAdded = 0

    try {
      const shippedPath = path.join(globalProjectPath, 'progress', 'shipped.md')

      if (!(await this.fileExists(shippedPath))) {
        return 0
      }

      let content = await fs.readFile(shippedPath, 'utf-8')

      const now = new Date()
      const week = this.getWeekNumber(now)
      const year = now.getFullYear()
      const weekHeader = `## Week ${week}, ${year}`

      if (!content.includes(weekHeader)) {
        content += `\n${weekHeader}\n`
      }

      for (const feature of this.analysis.features) {
        if (!content.includes(feature)) {
          const entry = `- ✅ **${feature}** _(auto-detected on ${now.toLocaleDateString()})_\n`
          const insertIndex = content.indexOf(weekHeader) + weekHeader.length + 1
          content = content.slice(0, insertIndex) + entry + content.slice(insertIndex)
          featuresAdded++
        }
      }

      if (featuresAdded > 0) {
        await fs.writeFile(shippedPath, content, 'utf-8')
      }

    } catch (error) {
      console.error('[analyzer] Error updating shipped.md:', error.message)
    }

    return featuresAdded
  }

  /**
   * Create detailed analysis report
   */
  async createAnalysisReport(globalProjectPath) {
    try {
      const analysisDir = path.join(globalProjectPath, 'analysis')
      await fs.mkdir(analysisDir, { recursive: true })

      const reportPath = path.join(analysisDir, 'repo-summary.md')
      const report = this.generateAnalysisReport()

      await fs.writeFile(reportPath, report, 'utf-8')
    } catch (error) {
      console.error('[analyzer] Error creating analysis report:', error.message)
    }
  }

  /**
   * Generate formatted analysis report
   */
  generateAnalysisReport() {
    const { commands, features, structure, gitHistory, technologies } = this.analysis

    return `# Project Analysis Report

**Generated:** ${new Date().toLocaleString()}

## 📊 Overview

- **Technologies:** ${technologies.join(', ') || 'Not detected'}
- **Commands Implemented:** ${commands.length}
- **Features Detected:** ${features.length}
- **Total Files:** ~${structure.fileCount}

## 🛠️ Implemented Commands

${commands.map(cmd => `- \`/p:${cmd}\``).join('\n') || '_(none detected)_'}

## ✨ Completed Features

${features.map(f => `- ${f}`).join('\n') || '_(none detected)_'}

## 🏗️ Project Structure

- **Has Tests:** ${structure.hasTests ? '✅' : '❌'}
- **Has Documentation:** ${structure.hasDocs ? '✅' : '❌'}
- **Has CI/CD:** ${structure.hasCI ? '✅' : '❌'}
- **Directories:** ${structure.directories.join(', ')}

## 📜 Git History

${gitHistory.hasGit ? `
- **Total Commits:** ${gitHistory.totalCommits}
- **Contributors:** ${gitHistory.contributors.join(', ')}
- **First Commit:** ${gitHistory.firstCommit}
- **Last Commit:** ${gitHistory.lastCommit}
` : '_Not a git repository_'}

## 💡 Recommendations

${this.generateRecommendations()}

---
_This report was auto-generated by prjct analyze_
`
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations() {
    const recommendations = []
    const { structure, gitHistory } = this.analysis

    if (!structure.hasTests) {
      recommendations.push('- Consider adding tests to improve code quality')
    }

    if (!structure.hasDocs) {
      recommendations.push('- Add documentation to help onboard new contributors')
    }

    if (!structure.hasCI) {
      recommendations.push('- Set up CI/CD for automated testing and deployment')
    }

    if (gitHistory.hasGit && gitHistory.totalCommits < 10) {
      recommendations.push('- Early stage project - focus on core features first')
    }

    if (recommendations.length === 0) {
      return '- Project is well-structured! Keep up the good work.'
    }

    return recommendations.join('\n')
  }

  /**
   * Helper: Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Helper: Count files recursively (with limit for performance)
   */
  async countFiles(dirPath, maxDepth = 3, currentDepth = 0) {
    if (currentDepth > maxDepth) return 0

    let count = 0

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue
        }

        if (entry.isFile()) {
          count++
        } else if (entry.isDirectory()) {
          count += await this.countFiles(
            path.join(dirPath, entry.name),
            maxDepth,
            currentDepth + 1
          )
        }
      }
    } catch {
    }

    return count
  }

  /**
   * Helper: Get week number
   */
  getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
  }
}

module.exports = new CodebaseAnalyzer()
