/**
 * HTTP Server for prjct-cli
 *
 * Hono-based server for web dashboard and API access.
 * Provides REST endpoints for project state and real-time updates via SSE.
 * Supports both Bun and Node.js runtimes.
 *
 * @version 1.1.0
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { ServerConfig, ServerHandle, ServerInstance } from '../types'
import { isBun } from '../utils/runtime'
import { VERSION } from '../utils/version'
import { createRoutes } from './routes'
import { createExtendedRoutes } from './routes-extended'
import { createSSEManager } from './sse'

/**
 * Create and configure the HTTP server
 */
export function createServer(config: ServerConfig): ServerInstance {
  const app = new Hono()
  const sseManager = createSSEManager()

  // Middleware
  if (config.enableCors !== false) {
    app.use(
      '*',
      cors({
        origin: '*',
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      })
    )
  }

  if (config.enableLogging !== false) {
    app.use('*', logger())
  }

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

  // API info
  app.get('/', (c) =>
    c.json({
      name: 'prjct-cli',
      version: VERSION,
      projectId: config.projectId,
      endpoints: {
        health: '/health',
        state: '/api/state',
        queue: '/api/queue',
        ideas: '/api/ideas',
        roadmap: '/api/roadmap',
        shipped: '/api/shipped',
        events: '/api/events',
        // Extended endpoints for status-bar
        projects: '/api/projects',
        projectFull: '/api/projects/:id/full',
        statusBarCompact: '/api/status-bar/compact',
        globalStats: '/api/stats/global',
      },
    })
  )

  // Mount API routes
  const routes = createRoutes(config.projectId, config.projectPath)
  app.route('/api', routes)

  // Mount extended routes for status-bar
  const extendedRoutes = createExtendedRoutes()
  app.route('/api', extendedRoutes)

  // SSE endpoint for real-time updates
  app.get('/api/events', (c) => {
    return sseManager.handleConnection(c)
  })

  let server: ServerHandle = null

  return {
    app,

    async start() {
      const port = config.port
      const host = config.host || '0.0.0.0'

      if (isBun()) {
        // Use Bun's native server (faster)
        server = Bun.serve({
          port,
          hostname: host,
          fetch: app.fetch,
        })
      } else {
        // Use @hono/node-server for Node.js
        const { serve } = await import('@hono/node-server')
        const nodeServer = serve({
          fetch: app.fetch,
          port,
          hostname: host,
        })
        server = {
          stop: () => nodeServer.close(),
        }
      }

      console.log(`🚀 prjct server running at http://${host}:${port}`)
      console.log(`   Project: ${config.projectId}`)
      console.log(`   Runtime: ${isBun() ? 'Bun' : 'Node.js'}`)
      console.log(`   Dashboard: http://localhost:${port}`)
    },

    stop() {
      sseManager.shutdown()
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
