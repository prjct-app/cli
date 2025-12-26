/**
 * Server Module
 *
 * HTTP server for prjct-cli web dashboard and API.
 *
 * @module core/server
 * @version 1.0.0
 */

export { createServer, startServer, DEFAULT_PORT } from './server'
export type { ServerConfig, ServerInstance } from './server'

export { createRoutes } from './routes'

export { createSSEManager, SSE_EVENTS } from './sse'
export type { SSEClient, SSEManager, SSEEventType } from './sse'
