/**
 * MCP server wiring during setup. Each block is independent: a
 * failure in one provider must not abort the others.
 *  - Context7: auto-installs and verifies (required for framework API lookups)
 *  - prjct: auto-installs the local MCP server for project memory/workflow.
 *  - Linear / Jira: optional integrations configured manually via their
 *    setup commands.
 */

import context7Service from '../../services/context7-service'
import { getErrorMessage } from '../../types/fs'
import {
  getClaudeMcpConfigPath,
  hasMcpServer,
  MCP_SERVER_PRESETS,
  upsertMcpServer,
} from '../../utils/mcp-config'

const DEFAULT_MCP_SERVERS = [
  {
    name: 'prjct',
    ready: '✅ prjct MCP already configured',
    added: '✅ prjct MCP added to mcp.json',
    failed: 'prjct MCP setup failed',
    manual: '   Run `prjct start` again to retry.',
  },
] as const

export async function setupMcpServers(
  options: { silent?: boolean; verifyContext7?: boolean } = {}
): Promise<void> {
  if (!options.silent) console.log('\n🔌 Configuring MCP servers...')

  try {
    await context7Service.install()
    const status = options.verifyContext7 === false ? null : await context7Service.verify()
    if (options.silent) {
      // sync verifies Context7 separately and reports in markdown output.
    } else if (status?.verified) {
      console.log('✅ Context7 MCP ready (framework API lookups)')
    } else {
      console.log(`⚠️  Context7 configured but not yet verified: ${status?.message || ''}`)
      console.log('   It will activate on the next time you open your AI client.')
    }
  } catch (error) {
    if (!options.silent) {
      console.log(`⚠️  Context7 MCP setup failed: ${getErrorMessage(error)}`)
      console.log('   Run `prjct start` again to retry.')
    }
  }

  for (const server of DEFAULT_MCP_SERVERS) {
    try {
      const configPath = getClaudeMcpConfigPath()
      const configured = await hasMcpServer(server.name, configPath)
      if (configured) {
        if (!options.silent) console.log(server.ready)
      } else {
        await upsertMcpServer(server.name, MCP_SERVER_PRESETS[server.name])
        if (!options.silent) console.log(server.added)
      }
    } catch (error) {
      if (!options.silent) {
        console.log(`⚠️  ${server.failed}: ${getErrorMessage(error)}`)
        console.log(server.manual)
      }
    }
  }
}
