/**
 * CommandInstaller - Installs prjct commands to Claude (Code + Desktop)
 *
 * 100% Claude-focused architecture
 * Handles installation and synchronization of /p:* commands
 * to Claude's native slash command system
 *
 * @version 0.5.0
 */

export type {
  InstallResult,
  UninstallResult,
  CheckResult,
  SyncResult,
  GlobalConfigResult,
} from './types'

export { installGlobalConfig } from './global-config'
export { CommandInstaller } from './command-installer'

import { CommandInstaller } from './command-installer'

const commandInstaller = new CommandInstaller()
export default commandInstaller
