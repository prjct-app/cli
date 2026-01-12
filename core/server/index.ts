/**
 * Server Module
 *
 * HTTP server for prjct-cli web dashboard and API.
 *
 * @module core/server
 * @version 1.0.0
 */

export { createServer, startServer, DEFAULT_PORT } from './server'
export { createRoutes } from './routes'
export { createExtendedRoutes } from './routes-extended'
export { createSSEManager, SSE_EVENTS } from './sse'

// Re-export types from canonical location
export type {
  ServerConfig,
  ServerInstance,
  SSEClient,
  SSEManager,
  SSEEventType,
} from '../types'
