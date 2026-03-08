/**
 * MCP Error Handler
 *
 * Wraps tool handlers with try/catch so unhandled errors return
 * `isError: true` instead of crashing the MCP stdio server.
 */

type McpContent = { type: string; text: string }
type McpResult = { content: McpContent[]; isError?: boolean }

/**
 * Wrap an MCP tool handler with error handling.
 * On success: returns the handler result.
 * On error: returns `{ isError: true, content: [{ type: 'text', text: '...' }] }`.
 */
export function safeMcpCall<T>(
  toolName: string,
  fn: (args: T) => Promise<McpResult>
): (args: T) => Promise<McpResult> {
  return async (args: T): Promise<McpResult> => {
    try {
      return await fn(args)
    } catch (error) {
      return mcpError(error, toolName)
    }
  }
}

/** Helper to build a successful MCP result. */
export function mcpResult(text: string): McpResult {
  return { content: [{ type: 'text', text }] }
}

/** Helper to build an error MCP result. */
export function mcpError(error: unknown, toolName: string): McpResult {
  const message = error instanceof Error ? error.message : String(error)
  return {
    content: [{ type: 'text', text: `[${toolName}] Error: ${message}` }],
    isError: true,
  }
}
