/**
 * Custom Error Hierarchy for prjct-cli
 *
 * Base error class with specific subclasses for different error domains.
 * Enables typed error handling and better error messages.
 *
 * Features:
 * - Zod-validated structured error data
 * - NamedError pattern (inspired by opencode)
 * - Type-safe error creation and handling
 *
 * @module core/errors
 * @version 2.0.0
 */

import { type ZodType, z } from 'zod'

// =============================================================================
// Named Error Pattern (Zod-based)
// =============================================================================

/**
 * Creates a typed error class with Zod schema validation
 * Inspired by opencode's NamedError pattern
 *
 * @example
 * const FileNotFound = NamedError.create('FileNotFound', z.object({
 *   path: z.string(),
 *   operation: z.enum(['read', 'write', 'delete'])
 * }))
 *
 * throw FileNotFound.throw({ path: '/foo/bar', operation: 'read' })
 */
export const NamedError = {
  create<T extends ZodType>(name: string, schema: T) {
    type Data = z.infer<T>

    class TypedError extends Error {
      readonly errorName: string
      readonly data: Data
      readonly isOperational = true

      constructor(data: Data) {
        const parsed = schema.parse(data)
        super(`${name}: ${JSON.stringify(parsed)}`)
        this.name = name
        this.errorName = name
        this.data = parsed
        Error.captureStackTrace?.(this, this.constructor)
      }

      static throw(data: Data): never {
        throw new TypedError(data)
      }

      static is(error: unknown): error is TypedError {
        return error instanceof TypedError && (error as TypedError).errorName === name
      }

      static create(data: Data): TypedError {
        return new TypedError(data)
      }
    }

    return TypedError
  },
}

// =============================================================================
// Typed Error Definitions (New Pattern)
// =============================================================================

/** File operation errors with path context */
export const FileError = NamedError.create(
  'FileError',
  z.object({
    path: z.string(),
    operation: z.enum(['read', 'write', 'delete', 'create', 'copy']),
    reason: z.string().optional(),
  })
)

/** Validation errors with field context */
export const ValidationError = NamedError.create(
  'ValidationError',
  z.object({
    field: z.string(),
    expected: z.string(),
    received: z.string().optional(),
    message: z.string().optional(),
  })
)

/** Permission errors */
export const PermissionError = NamedError.create(
  'PermissionError',
  z.object({
    action: z.string(),
    resource: z.string(),
    reason: z.string().optional(),
  })
)

/** Task operation errors */
export const TaskError = NamedError.create(
  'TaskError',
  z.object({
    taskId: z.string().optional(),
    operation: z.enum(['create', 'update', 'complete', 'pause', 'resume', 'delete']),
    reason: z.string(),
  })
)

/** Session errors */
export const SessionError = NamedError.create(
  'SessionError',
  z.object({
    sessionId: z.string().optional(),
    reason: z.string(),
  })
)

/** Sync errors */
export const SyncError = NamedError.create(
  'SyncError',
  z.object({
    projectId: z.string().optional(),
    operation: z.enum(['push', 'pull', 'auth', 'connect']),
    reason: z.string(),
  })
)

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Base error class for all prjct errors
 */
export class PrjctError extends Error {
  readonly code: string
  readonly isOperational: boolean

  constructor(message: string, code = 'PRJCT_ERROR') {
    super(message)
    this.name = 'PrjctError'
    this.code = code
    this.isOperational = true
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/**
 * Project-related errors
 */
export class ProjectError extends PrjctError {
  constructor(message: string, code = 'PROJECT_ERROR') {
    super(message, code)
    this.name = 'ProjectError'
  }

  static notInitialized(): ProjectError {
    return new ProjectError('Project not initialized. Run /p:init first.', 'PROJECT_NOT_INIT')
  }

  static notFound(projectId: string): ProjectError {
    return new ProjectError(`Project not found: ${projectId}`, 'PROJECT_NOT_FOUND')
  }

  static invalidId(projectId: string): ProjectError {
    return new ProjectError(`Invalid project ID: ${projectId}`, 'PROJECT_INVALID_ID')
  }
}

/**
 * Template-related errors
 */
export class TemplateError extends PrjctError {
  constructor(message: string, code = 'TEMPLATE_ERROR') {
    super(message, code)
    this.name = 'TemplateError'
  }

  static notFound(templateName: string): TemplateError {
    return new TemplateError(`Template not found: ${templateName}.md`, 'TEMPLATE_NOT_FOUND')
  }

  static parseFailed(templateName: string): TemplateError {
    return new TemplateError(`Failed to parse template: ${templateName}`, 'TEMPLATE_PARSE_ERROR')
  }
}

/**
 * Agent-related errors
 */
export class AgentError extends PrjctError {
  constructor(message: string, code = 'AGENT_ERROR') {
    super(message, code)
    this.name = 'AgentError'
  }

  static notSupported(agentType: string): AgentError {
    return new AgentError(`Unsupported agent type: ${agentType}`, 'AGENT_NOT_SUPPORTED')
  }

  static initFailed(reason: string): AgentError {
    return new AgentError(`Agent initialization failed: ${reason}`, 'AGENT_INIT_FAILED')
  }
}

/**
 * Type guard to check if error is a PrjctError
 */
export function isPrjctError(error: unknown): error is PrjctError {
  return error instanceof PrjctError
}

/**
 * Extract error message safely from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isPrjctError(error)) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Unknown error'
}

/**
 * Extract error code safely from unknown error
 */
export function getErrorCode(error: unknown): string {
  if (isPrjctError(error)) {
    return error.code
  }
  return 'UNKNOWN_ERROR'
}
