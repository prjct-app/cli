/**
 * prjct MCP Server — stdio entry point
 *
 * Usage: node dist/mcp/server.mjs
 *
 * Reads project ID from PRJCT_PROJECT_ID env var or auto-detects from cwd.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './server'

async function main() {
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  console.error('prjct MCP server failed:', error)
  process.exit(1)
})
