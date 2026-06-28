/**
 * Bridge from the static per-role model policy to the LIVE rig.
 *
 * The policy (schemas/model.ts) is provider-agnostic; this is where it meets
 * the active provider detected by ai-provider. On Claude we keep the rich,
 * tuned Claude-Agent-tool guidance; on any other rig we emit the provider-aware
 * directive so the same role policy travels with the brain — the model is
 * intercambiable, the harness is not. Dispatch flows should call this rather
 * than the raw renderers so they are correct on whatever rig is installed.
 */

import { getActiveProvider } from '../infrastructure/ai-provider'
import {
  type AgentRole,
  renderModelDirective,
  renderModelDirectiveForProvider,
} from '../schemas/model'
import type { AIProviderName } from '../types/provider'

export async function renderActiveModelDirective(
  role: AgentRole,
  projectProvider?: AIProviderName
): Promise<string> {
  const provider = (await getActiveProvider(projectProvider)).name
  return provider === 'claude'
    ? renderModelDirective(role)
    : renderModelDirectiveForProvider(role, provider)
}
