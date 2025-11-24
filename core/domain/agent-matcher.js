/**
 * AgentMatcher - Intelligent Agent Matching with Scoring
 * 
 * Matches tasks to agents using multi-factor scoring:
 * - Agent skills and capabilities
 * - Historical success rates
 * - Project technologies
 * - Task complexity
 * 
 * @version 1.0.0
 */

class AgentMatcher {
  constructor() {
    this.historyCache = new Map()
  }

  /**
   * Find best agent for a task using intelligent scoring
   * @param {Array<Object>} availableAgents - All available agents
   * @param {Object} taskAnalysis - Task analysis result
   * @returns {Object|null} Best matching agent with score
   */
  findBestAgent(availableAgents, taskAnalysis) {
    if (!availableAgents || availableAgents.length === 0) {
      return null
    }

    // Score each agent
    const scored = availableAgents.map(agent => {
      const score = this.scoreAgent(agent, taskAnalysis)
      return { agent, score }
    })

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score)

    // Return best match if score is above threshold
    const best = scored[0]
    if (best && best.score > 0.3) {
      return {
        agent: best.agent,
        score: best.score,
        alternatives: scored.slice(1, 3).map(s => ({
          agent: s.agent,
          score: s.score
        }))
      }
    }

    return null
  }

  /**
   * Score an agent for a specific task
   * Multi-factor scoring system
   */
  scoreAgent(agent, taskAnalysis) {
    let score = 0

    // Factor 1: Domain Match (40% weight)
    const domainScore = this.scoreDomainMatch(agent, taskAnalysis)
    score += domainScore * 0.4

    // Factor 2: Skills Match (30% weight)
    const skillsScore = this.scoreSkillsMatch(agent, taskAnalysis)
    score += skillsScore * 0.3

    // Factor 3: Historical Success (20% weight)
    const historyScore = this.scoreHistoricalSuccess(agent, taskAnalysis)
    score += historyScore * 0.2

    // Factor 4: Complexity Match (10% weight)
    const complexityScore = this.scoreComplexityMatch(agent, taskAnalysis)
    score += complexityScore * 0.1

    return Math.min(score, 1.0)
  }

  /**
   * Score domain match
   */
  scoreDomainMatch(agent, taskAnalysis) {
    const agentDomain = agent.domain || ''
    const taskDomain = taskAnalysis.primaryDomain || ''

    // Exact match
    if (agentDomain === taskDomain) {
      return 1.0
    }

    // Partial match (agent name contains domain)
    if (agent.name && agent.name.includes(taskDomain)) {
      return 0.7
    }

    // Check alternatives
    if (taskAnalysis.alternatives && taskAnalysis.alternatives.includes(agentDomain)) {
      return 0.5
    }

    return 0.1
  }

  /**
   * Score skills match
   */
  scoreSkillsMatch(agent, taskAnalysis) {
    if (!agent.skills || agent.skills.length === 0) {
      return 0.2 // Generic agent penalty
    }

    const projectTech = taskAnalysis.projectTechnologies || {}
    const allTech = [
      ...(projectTech.languages || []),
      ...(projectTech.frameworks || []),
      ...(projectTech.tools || [])
    ]

    // Count matching skills
    const matchingSkills = agent.skills.filter(skill => {
      const skillLower = skill.toLowerCase()
      return allTech.some(tech => tech.toLowerCase().includes(skillLower) || 
                                  skillLower.includes(tech.toLowerCase()))
    })

    if (matchingSkills.length === 0) {
      return 0.1 // No matching skills
    }

    // Score based on match ratio
    const matchRatio = matchingSkills.length / Math.max(agent.skills.length, allTech.length)
    return Math.min(matchRatio * 2, 1.0) // Boost for good matches
  }

  /**
   * Score historical success
   */
  scoreHistoricalSuccess(agent, taskAnalysis) {
    // TODO: Load from persistent history
    // For now, return neutral score
    const cacheKey = `${agent.name}-${taskAnalysis.primaryDomain}`
    const history = this.historyCache.get(cacheKey)

    if (history) {
      // Success rate from history
      return history.successRate || 0.5
    }

    return 0.5 // Neutral - no history
  }

  /**
   * Score complexity match
   */
  scoreComplexityMatch(agent, taskAnalysis) {
    const taskComplexity = taskAnalysis.complexity || 'medium'
    
    // Generic agents are better for simple tasks
    // Specialized agents are better for complex tasks
    const isGeneric = !agent.skills || agent.skills.length === 0

    if (taskComplexity === 'low' && isGeneric) {
      return 0.8
    }

    if (taskComplexity === 'high' && !isGeneric) {
      return 0.9
    }

    return 0.5 // Neutral
  }

  /**
   * Record agent success for learning
   */
  recordSuccess(agent, taskAnalysis, success = true) {
    const cacheKey = `${agent.name}-${taskAnalysis.primaryDomain}`
    const history = this.historyCache.get(cacheKey) || {
      attempts: 0,
      successes: 0,
      successRate: 0.5
    }

    history.attempts++
    if (success) {
      history.successes++
    }
    history.successRate = history.successes / history.attempts

    this.historyCache.set(cacheKey, history)
  }

  /**
   * Get match explanation
   */
  explainMatch(match) {
    if (!match) {
      return 'No suitable agent found'
    }

    const reasons = []

    if (match.score > 0.8) {
      reasons.push('Excellent match')
    } else if (match.score > 0.6) {
      reasons.push('Good match')
    } else {
      reasons.push('Acceptable match')
    }

    return reasons.join(', ')
  }
}

module.exports = AgentMatcher

