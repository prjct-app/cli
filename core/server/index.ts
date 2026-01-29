/**
 * Server Module
 *
 * HTTP server for prjct-cli web dashboard and API.
 *
 * @module core/server
 * @version 1.0.0
 */

// Re-export types from canonical location
export type {
  ServerConfig,
  ServerInstance,
  SSEClient,
  SSEEventType,
  SSEManager,
} from '../types'
export { createRoutes } from './routes'
export { createExtendedRoutes } from './routes-extended'
export { createServer, DEFAULT_PORT, startServer } from './server'
export { createSSEManager, SSE_EVENTS } from './sse'
