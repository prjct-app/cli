/**
 * MCP server wiring during setup. Each block is independent: a
 * failure in one provider must not abort the others.
 *  - Context7: auto-installs and verifies (required for framework API lookups)
 *  - Linear / Jira: registers the server in mcp.json; OAuth happens
 *    later inside the AI client itself.
 */

import context7Service from '../../services/context7-service'
import { getErrorMessage } from '../../types/fs'
import {
  getClaudeMcpConfigPath,
  hasMcpServer,
  MCP_SERVER_PRESETS,
  upsertMcpServer,
} from '../../utils/mcp-config'

export async function setupMcpServers(): Promise<void> {
  console.log('\n🔌 Configuring MCP servers...')

  try {
    await context7Service.install()
    const status = await context7Service.verify()
    if (status.verified) {
      console.log('✅ Context7 MCP ready (framework API lookups)')
    } else {
      console.log(`⚠️  Context7 configured but not yet verified: ${status.message || ''}`)
      console.log('   It will activate on the next time you open your AI client.')
    }
  } catch (error) {
    console.log(`⚠️  Context7 MCP setup failed: ${getErrorMessage(error)}`)
    console.log('   Run `prjct start` again to retry.')
  }

  try {
    const configPath = getClaudeMcpConfigPath()
    const linearConfigured = await hasMcpServer('linear', configPath)
    if (linearConfigured) {
      console.log('✅ Linear MCP already configured')
    } else {
      await upsertMcpServer('linear', MCP_SERVER_PRESETS.linear)
      console.log('✅ Linear MCP added to mcp.json')
      console.log('   → Open your AI client and run any Linear command to complete OAuth.')
    }
  } catch (error) {
    console.log(`⚠️  Linear MCP setup failed: ${getErrorMessage(error)}`)
    console.log('   Run `prjct linear setup` to configure manually.')
  }

  try {
    const configPath = getClaudeMcpConfigPath()
    const jiraConfigured = await hasMcpServer('jira', configPath)
    if (jiraConfigured) {
      console.log('✅ Jira MCP already configured')
    } else {
      await upsertMcpServer('jira', MCP_SERVER_PRESETS.jira)
      console.log('✅ Jira MCP added to mcp.json')
      console.log('   → Open your AI client and run any Jira command to complete OAuth.')
    }
  } catch (error) {
    console.log(`⚠️  Jira MCP setup failed: ${getErrorMessage(error)}`)
    console.log('   Run `prjct jira setup` to configure manually.')
  }
}
