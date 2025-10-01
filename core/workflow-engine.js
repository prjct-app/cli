/**
 * Workflow Engine
 * Orchestrates adaptive agent workflows based on project capabilities
 */

const fs = require('fs').promises
const path = require('path')
const capabilities = require('./project-capabilities')
const rules = require('./workflow-rules')

class WorkflowEngine {
  /**
   * Initialize workflow for task
   * @param {string} task - Task description
   * @param {string} type - Workflow type (ui, api, bug, refactor, feature)
   * @param {string} dataPath - Project data path
   * @returns {Promise<Object>} Workflow object
   */
  async init(task, type, dataPath) {
    // Detect project capabilities
    const projectPath = path.dirname(path.dirname(dataPath))
    const caps = await capabilities.detect(projectPath)

    // Get base workflow
    const base = rules[type] || rules.ui

    // Map all steps - mark for prompting if capability missing
    const steps = base.map((s, index) => ({
      ...s,
      index,
      status: 'pending',
      skipped: false,
      needsPrompt: !s.required && s.prompt && !caps[s.needs]
    }))

    // Track which capabilities are missing
    const missingCapabilities = base
      .filter(s => !s.required && s.needs && !caps[s.needs])
      .map(s => s.needs)

    const workflow = {
      task,
      type,
      caps,
      steps,
      missingCapabilities,
      current: 0,
      active: true,
      createdAt: new Date().toISOString()
    }

    await this.save(workflow, dataPath)
    return workflow
  }

  /**
   * Get current step info
   */
  async getCurrent(dataPath) {
    const wf = await this.load(dataPath)
    if (!wf || !wf.active) return null

    return wf.steps[wf.current]
  }

  /**
   * Advance to next step
   */
  async next(dataPath) {
    const wf = await this.load(dataPath)
    if (!wf) return null

    // Mark current step as completed
    wf.steps[wf.current].status = 'completed'
    wf.steps[wf.current].completedAt = new Date().toISOString()

    // Move to next
    wf.current++

    // Check if workflow complete
    if (wf.current >= wf.steps.length) {
      wf.active = false
      wf.completedAt = new Date().toISOString()
      await this.save(wf, dataPath)
      return null
    }

    // Mark next step as in progress
    wf.steps[wf.current].status = 'in_progress'
    wf.steps[wf.current].startedAt = new Date().toISOString()

    await this.save(wf, dataPath)
    return wf.steps[wf.current]
  }

  /**
   * Skip current step
   */
  async skip(dataPath, reason = 'User skipped') {
    const wf = await this.load(dataPath)
    if (!wf) return null

    wf.steps[wf.current].skipped = true
    wf.steps[wf.current].status = 'skipped'
    wf.steps[wf.current].skipReason = reason
    wf.steps[wf.current].skippedAt = new Date().toISOString()

    return await this.next(dataPath)
  }

  /**
   * Insert installation step before current step
   */
  async insertInstall(dataPath, installTask) {
    const wf = await this.load(dataPath)
    if (!wf) return null

    const currentIndex = wf.current

    // Insert install task at current position
    wf.steps.splice(currentIndex, 0, {
      ...installTask,
      index: currentIndex,
      status: 'in_progress',
      insertedAt: new Date().toISOString()
    })

    // Reindex all subsequent steps
    for (let i = currentIndex + 1; i < wf.steps.length; i++) {
      wf.steps[i].index = i
    }

    await this.save(wf, dataPath)
    return wf.steps[currentIndex]
  }

  /**
   * Classify task type from description
   * @param {string} text - Task description
   * @returns {string} Workflow type
   */
  classify(text) {
    const t = text.toLowerCase()

    if (/button|form|modal|card|component|menu|nav|input/.test(t)) return 'ui'
    if (/endpoint|api|service|route|controller/.test(t)) return 'api'
    if (/bug|fix|error|issue|broken/.test(t)) return 'bug'
    if (/refactor|improve|optimize|clean/.test(t)) return 'refactor'
    if (/feature|functionality|module/.test(t)) return 'feature'

    return 'ui' // Default
  }

  /**
   * Get workflow status
   */
  async getStatus(dataPath) {
    const wf = await this.load(dataPath)
    if (!wf) return null

    return {
      task: wf.task,
      type: wf.type,
      active: wf.active,
      current: wf.current,
      total: wf.steps.length,
      steps: wf.steps.map(s => ({
        name: s.name,
        status: s.status,
        agent: s.agent
      })),
      skipped: wf.skipped
    }
  }

  /**
   * Load workflow from file
   */
  async load(dataPath) {
    try {
      const workflowPath = path.join(dataPath, 'workflow', 'state.json')
      const content = await fs.readFile(workflowPath, 'utf8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /**
   * Save workflow to file
   */
  async save(workflow, dataPath) {
    const workflowDir = path.join(dataPath, 'workflow')
    await fs.mkdir(workflowDir, { recursive: true })

    const workflowPath = path.join(workflowDir, 'state.json')
    await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2))
  }

  /**
   * Clear workflow
   */
  async clear(dataPath) {
    try {
      const workflowPath = path.join(dataPath, 'workflow', 'state.json')
      await fs.unlink(workflowPath)
    } catch {
      // Ignore if doesn't exist
    }
  }
}

module.exports = new WorkflowEngine()
