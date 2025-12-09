/**
 * Layered Memory System
 * Three-tier memory for learning user patterns and preferences.
 *
 * @module agentic/memory-system
 * @version 3.3
 */

const fs = require('fs').promises
const path = require('path')
const pathManager = require('../infrastructure/path-manager')

/**
 * Semantic tags for memory categorization
 * @enum {string}
 */
const MEMORY_TAGS = {
  // Code preferences
  CODE_STYLE: 'code_style',
  NAMING_CONVENTION: 'naming_convention',
  FILE_STRUCTURE: 'file_structure',

  // Workflow preferences
  COMMIT_STYLE: 'commit_style',
  BRANCH_NAMING: 'branch_naming',
  TEST_BEHAVIOR: 'test_behavior',
  SHIP_WORKFLOW: 'ship_workflow',

  // Project context
  TECH_STACK: 'tech_stack',
  ARCHITECTURE: 'architecture',
  DEPENDENCIES: 'dependencies',

  // User preferences
  OUTPUT_VERBOSITY: 'output_verbosity',
  CONFIRMATION_LEVEL: 'confirmation_level',
  AGENT_PREFERENCE: 'agent_preference'
}

/**
 * Three-tier memory system for learning user patterns.
 * Tier 1: Session (ephemeral), Tier 2: Patterns (persistent), Tier 3: History (JSONL)
 */
class MemorySystem {
  constructor() {
    /** @type {Map<string, {value: any, timestamp: number}>} */
    this._sessionMemory = new Map()
    /** @type {Object|null} */
    this._patterns = null
    /** @type {boolean} */
    this._patternsLoaded = false
    /** @type {Object|null} */
    this._memories = null
    /** @type {boolean} */
    this._memoriesLoaded = false
  }

  // ═══════════════════════════════════════════════════════════
  // P3.3: SEMANTIC MEMORIES (tagged, searchable, CRUD)
  // ═══════════════════════════════════════════════════════════

  /**
   * Get path to memories database
   * @param {string} projectId
   * @returns {string}
   */
  _getMemoriesPath(projectId) {
    return path.join(
      pathManager.getGlobalProjectPath(projectId),
      'memory',
      'memories.json'
    )
  }

  /**
   * Load memories database
   * @param {string} projectId
   * @returns {Promise<Object>}
   */
  async loadMemories(projectId) {
    if (this._memoriesLoaded && this._memories) {
      return this._memories
    }

    try {
      const memoriesPath = this._getMemoriesPath(projectId)
      const content = await fs.readFile(memoriesPath, 'utf-8')
      this._memories = JSON.parse(content)
      this._memoriesLoaded = true
      return this._memories
    } catch {
      this._memories = {
        version: 1,
        memories: [], // Array of memory entries
        index: {}     // Tag -> memory IDs index
      }
      this._memoriesLoaded = true
      return this._memories
    }
  }

  /**
   * Save memories database
   * @param {string} projectId
   */
  async saveMemories(projectId) {
    if (!this._memories) return

    const memoriesPath = this._getMemoriesPath(projectId)
    await fs.mkdir(path.dirname(memoriesPath), { recursive: true })
    await fs.writeFile(
      memoriesPath,
      JSON.stringify(this._memories, null, 2),
      'utf-8'
    )
  }

  /**
   * Create a new memory (Windsurf pattern)
   *
   * @param {string} projectId
   * @param {Object} memory
   * @param {string} memory.title - Short title
   * @param {string} memory.content - Memory content
   * @param {string[]} memory.tags - Semantic tags
   * @param {boolean} memory.userTriggered - If user explicitly asked
   * @returns {Promise<string>} Memory ID
   */
  async createMemory(projectId, { title, content, tags = [], userTriggered = false }) {
    const db = await this.loadMemories(projectId)

    const memory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      content,
      tags,
      userTriggered,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    db.memories.push(memory)

    // Update tag index
    for (const tag of tags) {
      if (!db.index[tag]) db.index[tag] = []
      db.index[tag].push(memory.id)
    }

    await this.saveMemories(projectId)

    // Log to history
    await this.appendHistory(projectId, {
      type: 'memory_create',
      memoryId: memory.id,
      title,
      tags,
      userTriggered
    })

    return memory.id
  }

  /**
   * Update an existing memory
   *
   * @param {string} projectId
   * @param {string} memoryId
   * @param {Object} updates
   * @returns {Promise<boolean>}
   */
  async updateMemory(projectId, memoryId, updates) {
    const db = await this.loadMemories(projectId)

    const index = db.memories.findIndex(m => m.id === memoryId)
    if (index === -1) return false

    const memory = db.memories[index]
    const oldTags = memory.tags || []

    // Apply updates
    if (updates.title) memory.title = updates.title
    if (updates.content) memory.content = updates.content
    if (updates.tags) {
      // Update tag index
      for (const tag of oldTags) {
        if (db.index[tag]) {
          db.index[tag] = db.index[tag].filter(id => id !== memoryId)
        }
      }
      for (const tag of updates.tags) {
        if (!db.index[tag]) db.index[tag] = []
        db.index[tag].push(memoryId)
      }
      memory.tags = updates.tags
    }

    memory.updatedAt = new Date().toISOString()

    await this.saveMemories(projectId)

    await this.appendHistory(projectId, {
      type: 'memory_update',
      memoryId,
      updates: Object.keys(updates)
    })

    return true
  }

  /**
   * Delete a memory
   *
   * @param {string} projectId
   * @param {string} memoryId
   * @returns {Promise<boolean>}
   */
  async deleteMemory(projectId, memoryId) {
    const db = await this.loadMemories(projectId)

    const index = db.memories.findIndex(m => m.id === memoryId)
    if (index === -1) return false

    const memory = db.memories[index]

    // Remove from tag index
    for (const tag of memory.tags || []) {
      if (db.index[tag]) {
        db.index[tag] = db.index[tag].filter(id => id !== memoryId)
      }
    }

    // Remove memory
    db.memories.splice(index, 1)

    await this.saveMemories(projectId)

    await this.appendHistory(projectId, {
      type: 'memory_delete',
      memoryId,
      title: memory.title
    })

    return true
  }

  /**
   * Find memories by tags
   *
   * @param {string} projectId
   * @param {string[]} tags - Tags to search for
   * @param {boolean} matchAll - If true, memory must have ALL tags
   * @returns {Promise<Object[]>}
   */
  async findByTags(projectId, tags, matchAll = false) {
    const db = await this.loadMemories(projectId)

    if (matchAll) {
      // Memory must have ALL tags
      return db.memories.filter(m =>
        tags.every(tag => (m.tags || []).includes(tag))
      )
    } else {
      // Memory must have ANY tag
      const matchingIds = new Set()
      for (const tag of tags) {
        const ids = db.index[tag] || []
        ids.forEach(id => matchingIds.add(id))
      }
      return db.memories.filter(m => matchingIds.has(m.id))
    }
  }

  /**
   * Search memories by content (simple text match)
   *
   * @param {string} projectId
   * @param {string} query
   * @returns {Promise<Object[]>}
   */
  async searchMemories(projectId, query) {
    const db = await this.loadMemories(projectId)
    const queryLower = query.toLowerCase()

    return db.memories.filter(m =>
      m.title.toLowerCase().includes(queryLower) ||
      m.content.toLowerCase().includes(queryLower)
    )
  }

  /**
   * Get relevant memories for current context
   * Scores memories by relevance to context
   *
   * @param {string} projectId
   * @param {Object} context - Current execution context
   * @param {number} limit - Max memories to return
   * @returns {Promise<Object[]>}
   */
  async getRelevantMemories(projectId, context, limit = 5) {
    const db = await this.loadMemories(projectId)

    // Score each memory by relevance
    const scored = db.memories.map(memory => {
      let score = 0

      // Tag relevance
      const contextTags = this._extractContextTags(context)
      for (const tag of memory.tags || []) {
        if (contextTags.includes(tag)) score += 10
      }

      // Recency boost (more recent = higher score)
      const age = Date.now() - new Date(memory.updatedAt).getTime()
      const daysSinceUpdate = age / (1000 * 60 * 60 * 24)
      score += Math.max(0, 5 - daysSinceUpdate) // Up to 5 points for recent

      // User triggered memories are more important
      if (memory.userTriggered) score += 5

      // Content keyword match
      const keywords = this._extractKeywords(context)
      for (const keyword of keywords) {
        if (memory.content.toLowerCase().includes(keyword)) score += 2
        if (memory.title.toLowerCase().includes(keyword)) score += 3
      }

      return { ...memory, _score: score }
    })

    // Sort by score and return top N
    return scored
      .filter(m => m._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, ...memory }) => memory)
  }

  /**
   * Extract relevant tags from context
   * @private
   */
  _extractContextTags(context) {
    const tags = []

    // Command-based tags
    const commandTags = {
      ship: [MEMORY_TAGS.COMMIT_STYLE, MEMORY_TAGS.SHIP_WORKFLOW, MEMORY_TAGS.TEST_BEHAVIOR],
      feature: [MEMORY_TAGS.ARCHITECTURE, MEMORY_TAGS.CODE_STYLE],
      done: [MEMORY_TAGS.SHIP_WORKFLOW],
      analyze: [MEMORY_TAGS.TECH_STACK, MEMORY_TAGS.ARCHITECTURE],
      spec: [MEMORY_TAGS.ARCHITECTURE, MEMORY_TAGS.CODE_STYLE]
    }

    if (context.commandName && commandTags[context.commandName]) {
      tags.push(...commandTags[context.commandName])
    }

    return tags
  }

  /**
   * Extract keywords from context for matching
   * @private
   */
  _extractKeywords(context) {
    const keywords = []

    // From params
    if (context.params?.description) {
      keywords.push(...context.params.description.toLowerCase().split(/\s+/))
    }
    if (context.params?.feature) {
      keywords.push(...context.params.feature.toLowerCase().split(/\s+/))
    }

    // Filter common words
    const stopWords = ['the', 'a', 'an', 'is', 'are', 'to', 'for', 'and', 'or', 'in']
    return keywords.filter(k => k.length > 2 && !stopWords.includes(k))
  }

  /**
   * Auto-create memory from user decision
   * Called when user explicitly chooses something
   *
   * @param {string} projectId
   * @param {string} decisionType - Type of decision
   * @param {string} value - Chosen value
   * @param {string} context - Context of decision
   */
  async autoRemember(projectId, decisionType, value, context = '') {
    // Map decision types to tags
    const tagMap = {
      commit_footer: [MEMORY_TAGS.COMMIT_STYLE],
      branch_naming: [MEMORY_TAGS.BRANCH_NAMING],
      test_before_ship: [MEMORY_TAGS.TEST_BEHAVIOR, MEMORY_TAGS.SHIP_WORKFLOW],
      preferred_agent: [MEMORY_TAGS.AGENT_PREFERENCE],
      code_style: [MEMORY_TAGS.CODE_STYLE],
      verbosity: [MEMORY_TAGS.OUTPUT_VERBOSITY]
    }

    const tags = tagMap[decisionType] || []

    // Check if similar memory exists
    const existing = await this.searchMemories(projectId, decisionType)
    if (existing.length > 0) {
      // Update existing
      await this.updateMemory(projectId, existing[0].id, {
        content: `${decisionType}: ${value}`,
        tags
      })
    } else {
      // Create new
      await this.createMemory(projectId, {
        title: `Preference: ${decisionType}`,
        content: `${decisionType}: ${value}${context ? `\nContext: ${context}` : ''}`,
        tags,
        userTriggered: true
      })
    }
  }

  /**
   * Get all memories (for debugging/display)
   * @param {string} projectId
   * @returns {Promise<Object[]>}
   */
  async getAllMemories(projectId) {
    const db = await this.loadMemories(projectId)
    return db.memories
  }

  /**
   * Get memory stats
   * @param {string} projectId
   * @returns {Promise<Object>}
   */
  async getMemoryStats(projectId) {
    const db = await this.loadMemories(projectId)

    const tagCounts = {}
    for (const [tag, ids] of Object.entries(db.index)) {
      tagCounts[tag] = ids.length
    }

    return {
      totalMemories: db.memories.length,
      userTriggered: db.memories.filter(m => m.userTriggered).length,
      tagCounts,
      oldestMemory: db.memories[0]?.createdAt,
      newestMemory: db.memories[db.memories.length - 1]?.createdAt
    }
  }

  // ═══════════════════════════════════════════════════════════
  // TIER 1: Session Memory (ephemeral, single command context)
  // ═══════════════════════════════════════════════════════════

  /**
   * Store value in session memory
   * @param {string} key - Memory key
   * @param {any} value - Value to store
   */
  setSession(key, value) {
    this._sessionMemory.set(key, {
      value,
      timestamp: Date.now()
    })
  }

  /**
   * Get value from session memory
   * @param {string} key - Memory key
   * @returns {any} Stored value or undefined
   */
  getSession(key) {
    const entry = this._sessionMemory.get(key)
    return entry?.value
  }

  /**
   * Clear session memory
   */
  clearSession() {
    this._sessionMemory.clear()
  }

  // ═══════════════════════════════════════════════════════════
  // TIER 2: Patterns (persistent, learned preferences)
  // ═══════════════════════════════════════════════════════════

  /**
   * Get path to patterns file
   * @param {string} projectId - Project ID
   * @returns {string} Path to patterns.json
   */
  _getPatternsPath(projectId) {
    return path.join(
      pathManager.getGlobalProjectPath(projectId),
      'memory',
      'patterns.json'
    )
  }

  /**
   * Load patterns from disk
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Patterns object
   */
  async loadPatterns(projectId) {
    if (this._patternsLoaded && this._patterns) {
      return this._patterns
    }

    try {
      const patternsPath = this._getPatternsPath(projectId)
      const content = await fs.readFile(patternsPath, 'utf-8')
      this._patterns = JSON.parse(content)
      this._patternsLoaded = true
      return this._patterns
    } catch {
      // Initialize empty patterns
      this._patterns = {
        version: 1,
        decisions: {},      // Key decisions (e.g., commit_footer, branch_naming)
        preferences: {},    // User preferences (e.g., output_verbosity)
        workflows: {},      // Workflow patterns (e.g., quick_ship for small changes)
        counters: {}        // Usage counters for learning
      }
      this._patternsLoaded = true
      return this._patterns
    }
  }

  /**
   * Save patterns to disk
   * @param {string} projectId - Project ID
   */
  async savePatterns(projectId) {
    if (!this._patterns) return

    const patternsPath = this._getPatternsPath(projectId)

    // Ensure directory exists
    await fs.mkdir(path.dirname(patternsPath), { recursive: true })

    await fs.writeFile(
      patternsPath,
      JSON.stringify(this._patterns, null, 2),
      'utf-8'
    )
  }

  /**
   * Record a decision pattern
   * After 3 consistent uses, pattern becomes "learned"
   *
   * @param {string} projectId - Project ID
   * @param {string} key - Decision key (e.g., "commit_footer")
   * @param {string} value - Decision value
   * @param {string} context - Context where decision was made
   */
  async recordDecision(projectId, key, value, context = '') {
    const patterns = await this.loadPatterns(projectId)

    // Initialize or update decision
    if (!patterns.decisions[key]) {
      patterns.decisions[key] = {
        value,
        count: 1,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        confidence: 'low',
        contexts: [context].filter(Boolean)
      }
    } else {
      const decision = patterns.decisions[key]

      if (decision.value === value) {
        // Same value - increase confidence
        decision.count++
        decision.lastSeen = new Date().toISOString()
        if (context && !decision.contexts.includes(context)) {
          decision.contexts.push(context)
        }

        // Update confidence based on count
        if (decision.count >= 5) {
          decision.confidence = 'high'
        } else if (decision.count >= 3) {
          decision.confidence = 'medium'
        }
      } else {
        // Different value - reset if new value is used more
        decision.value = value
        decision.count = 1
        decision.lastSeen = new Date().toISOString()
        decision.confidence = 'low'
      }
    }

    await this.savePatterns(projectId)
  }

  /**
   * Get a learned decision
   * Returns null if not learned (confidence < medium)
   *
   * @param {string} projectId - Project ID
   * @param {string} key - Decision key
   * @returns {Promise<{value: string, confidence: string}|null>}
   */
  async getDecision(projectId, key) {
    const patterns = await this.loadPatterns(projectId)
    const decision = patterns.decisions[key]

    if (!decision) return null

    // Only return if confidence is at least medium
    if (decision.confidence === 'low') return null

    return {
      value: decision.value,
      confidence: decision.confidence
    }
  }

  /**
   * Check if a pattern exists (for quick checks)
   * @param {string} projectId - Project ID
   * @param {string} key - Pattern key
   * @returns {Promise<boolean>}
   */
  async hasPattern(projectId, key) {
    const decision = await this.getDecision(projectId, key)
    return decision !== null
  }

  /**
   * Record a workflow pattern
   * E.g., "user ships docs changes without running tests"
   *
   * @param {string} projectId - Project ID
   * @param {string} workflowName - Workflow identifier
   * @param {Object} pattern - Workflow pattern details
   */
  async recordWorkflow(projectId, workflowName, pattern) {
    const patterns = await this.loadPatterns(projectId)

    if (!patterns.workflows[workflowName]) {
      patterns.workflows[workflowName] = {
        ...pattern,
        count: 1,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      }
    } else {
      patterns.workflows[workflowName].count++
      patterns.workflows[workflowName].lastSeen = new Date().toISOString()
    }

    await this.savePatterns(projectId)
  }

  /**
   * Get workflow pattern if learned
   * @param {string} projectId - Project ID
   * @param {string} workflowName - Workflow identifier
   * @returns {Promise<Object|null>}
   */
  async getWorkflow(projectId, workflowName) {
    const patterns = await this.loadPatterns(projectId)
    const workflow = patterns.workflows[workflowName]

    if (!workflow || workflow.count < 3) return null

    return workflow
  }

  /**
   * Set user preference
   * @param {string} projectId - Project ID
   * @param {string} key - Preference key
   * @param {any} value - Preference value
   */
  async setPreference(projectId, key, value) {
    const patterns = await this.loadPatterns(projectId)
    patterns.preferences[key] = {
      value,
      updatedAt: new Date().toISOString()
    }
    await this.savePatterns(projectId)
  }

  /**
   * Get user preference
   * @param {string} projectId - Project ID
   * @param {string} key - Preference key
   * @param {any} defaultValue - Default if not set
   * @returns {Promise<any>}
   */
  async getPreference(projectId, key, defaultValue = null) {
    const patterns = await this.loadPatterns(projectId)
    return patterns.preferences[key]?.value ?? defaultValue
  }

  // ═══════════════════════════════════════════════════════════
  // TIER 3: History (append-only JSONL audit log)
  // ═══════════════════════════════════════════════════════════

  /**
   * Get path to today's session file
   * @param {string} projectId - Project ID
   * @returns {string} Path to session JSONL
   */
  _getSessionPath(projectId) {
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const day = now.toISOString().split('T')[0]

    return path.join(
      pathManager.getGlobalProjectPath(projectId),
      'memory',
      'sessions',
      yearMonth,
      `${day}.jsonl`
    )
  }

  /**
   * Append entry to history (JSONL)
   * @param {string} projectId - Project ID
   * @param {Object} entry - Entry to log
   */
  async appendHistory(projectId, entry) {
    const sessionPath = this._getSessionPath(projectId)

    // Ensure directory exists
    await fs.mkdir(path.dirname(sessionPath), { recursive: true })

    const logEntry = {
      ts: new Date().toISOString(),
      ...entry
    }

    await fs.appendFile(
      sessionPath,
      JSON.stringify(logEntry) + '\n',
      'utf-8'
    )
  }

  /**
   * Read recent history entries
   * @param {string} projectId - Project ID
   * @param {number} limit - Max entries to return
   * @returns {Promise<Object[]>}
   */
  async getRecentHistory(projectId, limit = 20) {
    try {
      const sessionPath = this._getSessionPath(projectId)
      const content = await fs.readFile(sessionPath, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)

      return lines
        .slice(-limit)
        .map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        })
        .filter(Boolean)
    } catch {
      return []
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CONVENIENCE: Combined operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Smart decision: Check pattern first, ask user only if unknown
   * Returns existing pattern or null (caller should ask user)
   *
   * @param {string} projectId - Project ID
   * @param {string} key - Decision key
   * @returns {Promise<string|null>} Known value or null
   */
  async getSmartDecision(projectId, key) {
    // Check session first (most recent)
    const sessionValue = this.getSession(`decision:${key}`)
    if (sessionValue !== undefined) return sessionValue

    // Check learned patterns
    const pattern = await this.getDecision(projectId, key)
    if (pattern) return pattern.value

    return null
  }

  /**
   * Record decision and store in session
   * @param {string} projectId - Project ID
   * @param {string} key - Decision key
   * @param {string} value - Decision value
   * @param {string} context - Context
   */
  async learnDecision(projectId, key, value, context = '') {
    // Store in session for immediate reuse
    this.setSession(`decision:${key}`, value)

    // Record in patterns for future sessions
    await this.recordDecision(projectId, key, value, context)

    // Log to history
    await this.appendHistory(projectId, {
      type: 'decision',
      key,
      value,
      context
    })
  }

  /**
   * Get all patterns summary (for debugging/display)
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>}
   */
  async getPatternsSummary(projectId) {
    const patterns = await this.loadPatterns(projectId)

    return {
      decisions: Object.keys(patterns.decisions).length,
      learnedDecisions: Object.values(patterns.decisions)
        .filter(d => d.confidence !== 'low').length,
      workflows: Object.keys(patterns.workflows).length,
      preferences: Object.keys(patterns.preferences).length
    }
  }
}

module.exports = new MemorySystem()
