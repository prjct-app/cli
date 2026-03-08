/**
 * prjct MCP Server
 *
 * Exposes project data via Model Context Protocol (20 tools).
 * Wraps existing storage and context modules — no new logic.
 *
 * @module mcp/server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerFileTools } from './tools/files'
import { registerMemoryTools } from './tools/memory'
import { registerProjectTools } from './tools/project'
import { registerSessionTools } from './tools/session'
import { registerWorkflowTools } from './tools/workflow'

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'prjct',
    version: '1.0.0',
  })

  registerMemoryTools(server)
  registerSessionTools(server)
  registerProjectTools(server)
  registerFileTools(server)
  registerWorkflowTools(server)

  return server
}
