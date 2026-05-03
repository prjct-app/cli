/**
 * Authentication flows: API-key login, browser-OAuth login, logout,
 * status. The auth() entrypoint is a thin dispatcher kept for the
 * external callers that drive it via a string subcommand.
 */

import http from 'node:http'
import chalk from 'chalk'
import configManager from '../../infrastructure/config-manager'
import authConfig from '../../sync/auth-config'
import { syncClient } from '../../sync/sync-client'
import syncManager from '../../sync/sync-manager'
import type { CommandResult } from '../../types/commands'
import { execAsync } from '../../utils/exec'
import out from '../../utils/output'
import { buildErrorPage, buildSuccessPage } from './oauth-pages'

export async function auth(
  action: string | null = null,
  options: { md?: boolean } = {}
): Promise<CommandResult> {
  const subcommand = action?.split(' ')[0] || 'status'
  const args = action?.split(' ').slice(1) || []

  switch (subcommand) {
    case 'login': {
      const apiKey = args[0]
      if (!apiKey) {
        if (!options.md) out.fail('Usage: prjct login [--url <url>]')
        return {
          success: false,
          message: options.md ? '## Error\nUsage: `prjct login [--url <url>]`' : '',
        }
      }

      let apiUrl: string | undefined
      const urlIdx = args.indexOf('--url')
      if (urlIdx !== -1 && args[urlIdx + 1]) {
        apiUrl = args[urlIdx + 1]
      }

      await authConfig.write({
        apiKey,
        ...(apiUrl ? { apiUrl } : {}),
      })

      const connected = await syncClient.testConnection()

      if (connected) {
        if (!options.md) {
          out.done('Connected! API key saved')
          out.info(chalk.dim(`Key: ${apiKey.substring(0, 12)}...`))
        }
        return {
          success: true,
          message: options.md
            ? `## Auth\n- **Status**: Connected\n- **Key**: \`${apiKey.substring(0, 12)}...\`\n- **API**: ${apiUrl || 'default'}`
            : '',
        }
      }
      if (!options.md) {
        out.warn('API key saved, but server is unreachable')
        out.info(chalk.dim(`Key: ${apiKey.substring(0, 12)}...`))
        out.info(chalk.dim('The key will be used when the server becomes available'))
      }
      return {
        success: true,
        message: options.md
          ? `## Auth\n- **Status**: Key saved (server unreachable)\n- **Key**: \`${apiKey.substring(0, 12)}...\``
          : '',
      }
    }

    case 'logout': {
      await authConfig.clearAuth()
      if (!options.md) out.done('Logged out. Auth credentials cleared')
      return {
        success: true,
        message: options.md ? '## Auth\n- **Status**: Logged out' : '',
      }
    }

    default: {
      const status = await authConfig.getStatus()
      if (options.md) {
        return {
          success: true,
          message: status.authenticated
            ? `## Auth Status\n- **Authenticated**: Yes\n- **Email**: ${status.email || 'N/A'}\n- **Key**: \`${status.apiKeyPrefix}\`\n- **Last auth**: ${status.lastAuth || 'N/A'}`
            : '## Auth Status\n- **Authenticated**: No\n- Run `prjct login` to connect',
        }
      }
      if (status.authenticated) {
        out.box(
          'Auth Status',
          `Email:  ${status.email || 'N/A'}\nKey:    ${status.apiKeyPrefix}\nSince:  ${status.lastAuth || 'N/A'}`
        )
      } else {
        out.info('Not authenticated')
        out.info(`Run ${chalk.cyan('prjct login')} to connect`)
      }
      return { success: true, message: '' }
    }
  }
}

/**
 * Browser-based login: spins up a local HTTP server, opens the web
 * login URL, waits for the OAuth callback to deliver the API key.
 */
export async function login(options: { md?: boolean; url?: string } = {}): Promise<CommandResult> {
  const status = await authConfig.getStatus()
  if (status.authenticated) {
    if (!options.md) {
      out.box('Already Authenticated', `Email:  ${status.email}\nKey:    ${status.apiKeyPrefix}`)
      out.info(`Run ${chalk.cyan('prjct logout')} first to re-authenticate`)
    }
    return {
      success: true,
      message: options.md
        ? `## Already Authenticated\n- **Email**: ${status.email}\n- **Key**: \`${status.apiKeyPrefix}\`\n\nRun \`prjct logout\` first to re-authenticate.`
        : '',
    }
  }

  const webUrl = options.url || process.env.PRJCT_WEB_URL || 'http://localhost:3000'

  return new Promise<CommandResult>((resolve) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1`)

      if (url.pathname === '/callback') {
        const apiKey = url.searchParams.get('key')
        const email = url.searchParams.get('email')
        const userId = url.searchParams.get('user_id')

        if (apiKey) {
          await authConfig.saveAuth(apiKey, userId || '', email || '')
          const apiUrl = `${webUrl}/api`
          await authConfig.write({ apiUrl })

          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(buildSuccessPage(email || '', apiKey.substring(0, 12)))
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(buildErrorPage('No API key received'))
        }

        server.close()

        if (apiKey) {
          if (!options.md) {
            out.step(3, 3, 'Connected')
            out.stop()
            out.box(
              'Authentication Complete',
              `Email:  ${email}\nKey:    ${apiKey.substring(0, 12)}...\nStatus: Connected`
            )
          }

          await autoSync()

          resolve({
            success: true,
            message: options.md
              ? `## Authenticated\n- **Email**: ${email}\n- **Key**: \`${apiKey.substring(0, 12)}...\``
              : '',
          })
        } else {
          if (!options.md) out.fail('Authentication failed: no API key received')
          resolve({
            success: false,
            message: options.md ? '## Error\nAuthentication failed: no API key received' : '',
          })
        }
        return
      }

      res.writeHead(404)
      res.end('Not found')
    })

    server.listen(0, '127.0.0.1', async () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        server.close()
        if (!options.md) out.fail('Failed to start callback server')
        resolve({
          success: false,
          message: options.md ? '## Error\nFailed to start callback server' : '',
        })
        return
      }

      const port = addr.port
      const loginUrl = `${webUrl}/login?redirect=${encodeURIComponent(`/api/auth/cli-login?port=${port}`)}`

      out.step(1, 3, 'Opening browser...')
      out.stop()
      out.info(chalk.dim(loginUrl))

      const platform = process.platform
      const openCmd =
        platform === 'darwin'
          ? `open "${loginUrl}"`
          : platform === 'win32'
            ? `start "${loginUrl}"`
            : `xdg-open "${loginUrl}"`

      try {
        await execAsync(openCmd)
      } catch {
        out.warn('Could not open browser automatically')
        out.info(`Visit: ${loginUrl}`)
      }

      out.step(2, 3, 'Waiting for authentication...')
    })

    setTimeout(
      () => {
        server.close()
        out.stop()
        if (!options.md) {
          out.fail('Authentication timed out')
          out.info(`Run ${chalk.cyan('prjct login')} to try again`)
        }
        resolve({
          success: false,
          message: options.md
            ? '## Error\nAuthentication timed out. Run `prjct login` to try again.'
            : '',
        })
      },
      5 * 60 * 1000
    )
  })
}

export async function logout(): Promise<CommandResult> {
  const status = await authConfig.getStatus()
  if (!status.authenticated) {
    out.info('Already logged out')
    return { success: true, message: '' }
  }

  await authConfig.clearAuth()
  out.done('Logged out')
  return { success: true, message: '' }
}

async function autoSync(): Promise<void> {
  try {
    const projectId = await configManager.getProjectId(process.cwd())
    if (!projectId) return

    out.spin('Syncing project...')
    const result = await syncManager.sync(projectId)
    out.stop()

    if (result.success && !result.skipped) {
      const pushed = result.pushed?.count || 0
      const pulled = result.pulled?.count || 0
      if (pushed > 0 || pulled > 0) {
        out.done(`Synced (${pushed} pushed, ${pulled} pulled)`)
      } else {
        out.done('Synced — everything up to date')
      }
    }
  } catch {
    out.stop()
  }
}
