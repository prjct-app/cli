/**
 * HTTP Server for prjct-cli
 *
 * Hono-based server for web dashboard and API access.
 * Provides REST endpoints for project state and real-time updates via SSE.
 *
 * @version 1.0.0
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createRoutes } from './routes'
import { createSSEManager } from './sse'

export interface ServerConfig {
  port: number
  host?: string
  projectId: string
  projectPath: string
  enableCors?: boolean
  enableLogging?: boolean
}

export interface ServerInstance {
  app: Hono
  start: () => Promise<void>
  stop: () => void
  broadcast: (event: string, data: unknown) => void
}

/**
 * Create and configure the HTTP server
 */
export function createServer(config: ServerConfig): ServerInstance {
  const app = new Hono()
  const sseManager = createSSEManager()

  // Middleware
  if (config.enableCors !== false) {
    app.use('*', cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }))
  }

  if (config.enableLogging !== false) {
    app.use('*', logger())
  }

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

  // API info
  app.get('/', (c) => c.json({
    name: 'prjct-cli',
    version: '0.20.0',
    projectId: config.projectId,
    endpoints: {
      health: '/health',
      state: '/api/state',
      queue: '/api/queue',
      ideas: '/api/ideas',
      roadmap: '/api/roadmap',
      shipped: '/api/shipped',
      events: '/api/events',
    }
  }))

  // Mount API routes
  const routes = createRoutes(config.projectId, config.projectPath)
  app.route('/api', routes)

  // SSE endpoint for real-time updates
  app.get('/api/events', (c) => {
    return sseManager.handleConnection(c)
  })

  let server: ReturnType<typeof Bun.serve> | null = null

  return {
    app,

    async start() {
      const port = config.port
      const host = config.host || '0.0.0.0'

      server = Bun.serve({
        port,
        hostname: host,
        fetch: app.fetch,
      })

      console.log(`🚀 prjct server running at http://${host}:${port}`)
      console.log(`   Project: ${config.projectId}`)
      console.log(`   Dashboard: http://localhost:${port}`)
    },

    stop() {
      if (server) {
        server.stop()
        server = null
        console.log('Server stopped')
      }
    },

    broadcast(event: string, data: unknown) {
      sseManager.broadcast(event, data)
    },
  }
}

/**
 * Default port for prjct server
 */
export const DEFAULT_PORT = 3478 // "prjct" on phone keypad

/**
 * Quick start server with minimal config
 */
export async function startServer(projectId: string, projectPath: string, port = DEFAULT_PORT) {
  const server = createServer({
    port,
    projectId,
    projectPath,
  })

  await server.start()
  return server
}
