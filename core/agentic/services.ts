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
 * import * as templateLoader from './template-loader'
 * import contextBuilder from './context-builder'
 * // ... 12 more imports
 *
 * // Use:
 * const template = await services.templates.load('now')
 * const context = await services.context.build(projectPath)
 * ```
 */

import { ideasStorage, queueStorage, shippedStorage, stateStorage } from '../storage'
import { outcomeAnalyzer, outcomeRecorder } from '../workflows'
import agentRouter from './agent-router'
import chainOfThought from './chain-of-thought'
import contextBuilder from './context-builder'
import groundTruth from './ground-truth'
import loopDetector from './loop-detector'
import memorySystem from './memory-system'
import planMode from './plan-mode'
import promptBuilder from './prompt-builder'
import smartContext from './smart-context'
import templateLoader from './template-loader'
import toolRegistry from './tool-registry'

// Storage managers object (replaces mdManagers)
const storageManagers = {
  state: stateStorage,
  queue: queueStorage,
  ideas: ideasStorage,
  shipped: shippedStorage,
}

import agentPerformanceTracker from './performance'

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
   * Chain of thought - adds reasoning to responses
   * @see chainOfThought
   */
  reasoning: typeof chainOfThought

  /**
   * Plan mode - handles planning workflow
   * @see planMode
   */
  planning: typeof planMode

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
   * Storage managers - Write-through state management
   * @see storageManagers
   */
  data: typeof storageManagers

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
  reasoning: chainOfThought,
  planning: planMode,
  router: agentRouter,
  smartContext: smartContext,
  data: storageManagers,
  outcomes: outcomeRecorder,
  outcomeAnalysis: outcomeAnalyzer,
  agentPerformance: agentPerformanceTracker,
}

export default services
