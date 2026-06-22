/**
 * Custom Error Hierarchy for prjct-cli
 *
 * Base error class with specific subclasses for different error domains.
 * Enables typed error handling and better error messages.
 *
 */

/**
 * Base error class for all prjct errors
 */
class PrjctError extends Error {
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
    return new ProjectError('Project not initialized. Run p. init first.', 'PROJECT_NOT_INIT')
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
function isPrjctError(error: unknown): error is PrjctError {
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
