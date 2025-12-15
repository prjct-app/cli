/**
 * Custom Error Hierarchy for prjct-cli
 *
 * Base error class with specific subclasses for different error domains.
 * Enables typed error handling and better error messages.
 *
 * @module core/errors
 * @version 1.0.0
 */

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
    this.isOperational = true // Distinguishes from programming errors
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/**
 * Configuration-related errors
 */
export class ConfigError extends PrjctError {
  constructor(message: string, code = 'CONFIG_ERROR') {
    super(message, code)
    this.name = 'ConfigError'
  }

  static notFound(path: string): ConfigError {
    return new ConfigError(`Configuration not found: ${path}`, 'CONFIG_NOT_FOUND')
  }

  static invalid(reason: string): ConfigError {
    return new ConfigError(`Invalid configuration: ${reason}`, 'CONFIG_INVALID')
  }

  static parseError(path: string): ConfigError {
    return new ConfigError(`Failed to parse configuration: ${path}`, 'CONFIG_PARSE_ERROR')
  }
}

/**
 * Storage and file system errors
 */
export class StorageError extends PrjctError {
  constructor(message: string, code = 'STORAGE_ERROR') {
    super(message, code)
    this.name = 'StorageError'
  }

  static readFailed(path: string): StorageError {
    return new StorageError(`Failed to read: ${path}`, 'STORAGE_READ_FAILED')
  }

  static writeFailed(path: string): StorageError {
    return new StorageError(`Failed to write: ${path}`, 'STORAGE_WRITE_FAILED')
  }

  static notFound(path: string): StorageError {
    return new StorageError(`File not found: ${path}`, 'STORAGE_NOT_FOUND')
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
 * Command execution errors
 */
export class CommandError extends PrjctError {
  constructor(message: string, code = 'COMMAND_ERROR') {
    super(message, code)
    this.name = 'CommandError'
  }

  static notFound(commandName: string): CommandError {
    return new CommandError(`Command not found: ${commandName}`, 'COMMAND_NOT_FOUND')
  }

  static invalidParams(reason: string): CommandError {
    return new CommandError(`Invalid parameters: ${reason}`, 'COMMAND_INVALID_PARAMS')
  }

  static executionFailed(commandName: string, reason: string): CommandError {
    return new CommandError(`Command '${commandName}' failed: ${reason}`, 'COMMAND_EXEC_FAILED')
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
 * Type guard for specific error types
 */
export function isConfigError(error: unknown): error is ConfigError {
  return error instanceof ConfigError
}

export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError
}

export function isProjectError(error: unknown): error is ProjectError {
  return error instanceof ProjectError
}

export function isCommandError(error: unknown): error is CommandError {
  return error instanceof CommandError
}

export function isTemplateError(error: unknown): error is TemplateError {
  return error instanceof TemplateError
}

export function isAgentError(error: unknown): error is AgentError {
  return error instanceof AgentError
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
