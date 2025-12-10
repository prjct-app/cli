/**
 * Agentic Services Facade
 *
 * Single entry point for all agentic subsystems.
 * Use this facade instead of importing individual modules.
 *
 * This reduces the number of imports Claude needs to understand
 * and provides a clear API for the agentic system.
 *
 * @example
 * ```typescript
 * import { services } from './services'
 *
 * // Instead of:
 * import templateLoader from './template-loader'
 * import contextBuilder from './context-builder'
 * // ... 12 more imports
 *
 * // Use:
 * const template = await services.templates.load('now')
 * const context = await services.context.build(projectPath)
 * ```
 */

import templateLoader from './template-loader'
import contextBuilder from './context-builder'
import promptBuilder from './prompt-builder'
import toolRegistry from './tool-registry'
import loopDetector from './loop-detector'
import memorySystem from './memory-system'
import groundTruth from './ground-truth'
import semanticCompression from './semantic-compression'
import responseTemplates from './response-templates'
import chainOfThought from './chain-of-thought'
import thinkBlocks from './think-blocks'
import parallelTools from './parallel-tools'
import planMode from './plan-mode'
import contextFilter from './context-filter'
import validationRules from './validation-rules'
import agentRouter from './agent-router'
import smartContext from './smart-context'
import stateManager from '../state'
import { outcomeRecorder, outcomeAnalyzer } from '../outcomes'
import { agentPerformanceTracker } from '../agents'

/**
 * Agentic services interface.
 * Each property provides access to a subsystem.
 */
export interface AgenticServices {
  /**
   * Template loader - loads command templates from templates/
   * @see templateLoader
   */
  templates: typeof templateLoader

  /**
   * Context builder - builds ProjectContext for commands
   * @see contextBuilder
   */
  context: typeof contextBuilder

  /**
   * Prompt builder - generates prompts from templates and context
   * @see promptBuilder
   */
  prompts: typeof promptBuilder

  /**
   * Tool registry - registers and executes tools (Read, Write, Bash, etc.)
   * @see toolRegistry
   */
  tools: typeof toolRegistry

  /**
   * Loop detector - detects and prevents infinite loops
   * @see loopDetector
   */
  loops: typeof loopDetector

  /**
   * Memory system - stores and retrieves learned patterns
   * @see memorySystem
   */
  memory: typeof memorySystem

  /**
   * Ground truth - verifies command preconditions
   * @see groundTruth
   */
  truth: typeof groundTruth

  /**
   * Semantic compression - compresses context to fit token limits
   * @see semanticCompression
   */
  compression: typeof semanticCompression

  /**
   * Response templates - generates formatted responses
   * @see responseTemplates
   */
  responses: typeof responseTemplates

  /**
   * Chain of thought - adds reasoning to responses
   * @see chainOfThought
   */
  reasoning: typeof chainOfThought

  /**
   * Think blocks - generates think block content
   * @see thinkBlocks
   */
  thinking: typeof thinkBlocks

  /**
   * Parallel tools - executes tools in parallel
   * @see parallelTools
   */
  parallel: typeof parallelTools

  /**
   * Plan mode - handles planning workflow
   * @see planMode
   */
  planning: typeof planMode

  /**
   * Context filter - filters context for relevance
   * @see contextFilter
   */
  filter: typeof contextFilter

  /**
   * Validation rules - validates command inputs
   * @see validationRules
   */
  validation: typeof validationRules

  /**
   * Agent router - routes tasks to appropriate agents
   * @see agentRouter
   */
  router: typeof agentRouter

  /**
   * Smart context - intelligent context filtering by task type
   * @see smartContext
   */
  smartContext: typeof smartContext

  /**
   * State manager - unified project state (read/write state.json)
   * @see stateManager
   */
  state: typeof stateManager

  /**
   * Outcome recorder - records execution outcomes
   * @see outcomeRecorder
   */
  outcomes: typeof outcomeRecorder

  /**
   * Outcome analyzer - analyzes outcomes for patterns
   * @see outcomeAnalyzer
   */
  outcomeAnalysis: typeof outcomeAnalyzer

  /**
   * Agent performance tracker - tracks agent performance
   * @see agentPerformanceTracker
   */
  agentPerformance: typeof agentPerformanceTracker
}

/**
 * Singleton services instance.
 * Import and use this instead of individual module imports.
 */
export const services: AgenticServices = {
  templates: templateLoader,
  context: contextBuilder,
  prompts: promptBuilder,
  tools: toolRegistry,
  loops: loopDetector,
  memory: memorySystem,
  truth: groundTruth,
  compression: semanticCompression,
  responses: responseTemplates,
  reasoning: chainOfThought,
  thinking: thinkBlocks,
  parallel: parallelTools,
  planning: planMode,
  filter: contextFilter,
  validation: validationRules,
  router: agentRouter,
  smartContext: smartContext,
  state: stateManager,
  outcomes: outcomeRecorder,
  outcomeAnalysis: outcomeAnalyzer,
  agentPerformance: agentPerformanceTracker,
}

export default services
