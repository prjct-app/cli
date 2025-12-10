/**
 * Agents Manager
 *
 * Manages agents.json - specialized AI agents.
 */

import { ArrayManager } from './base-manager'
import type { AgentSchema, AgentsSchema } from '../schemas'
import { DEFAULT_AGENT } from '../schemas'

class AgentsManager extends ArrayManager<AgentSchema> {
  constructor() {
    super('agents.json')
  }

  async getAgents(projectId: string): Promise<AgentsSchema> {
    return this.read(projectId)
  }

  async getAgent(projectId: string, name: string): Promise<AgentSchema | undefined> {
    return this.find(projectId, (agent) => agent.name === name)
  }

  async addAgent(
    projectId: string,
    agent: Pick<AgentSchema, 'name' | 'description'> & Partial<AgentSchema>
  ): Promise<AgentsSchema> {
    const fullAgent: AgentSchema = {
      ...DEFAULT_AGENT,
      ...agent
    }
    return this.add(projectId, fullAgent)
  }

  async updateAgent(
    projectId: string,
    name: string,
    updates: Partial<AgentSchema>
  ): Promise<AgentsSchema> {
    return this.updateItem(
      projectId,
      (agent) => agent.name === name,
      (agent) => ({ ...agent, ...updates })
    )
  }

  async removeAgent(projectId: string, name: string): Promise<AgentsSchema> {
    return this.remove(projectId, (agent) => agent.name === name)
  }

  async setAgents(projectId: string, agents: AgentsSchema): Promise<void> {
    await this.write(projectId, agents)
  }

  async incrementTasksCompleted(projectId: string, name: string): Promise<AgentsSchema> {
    return this.updateItem(
      projectId,
      (agent) => agent.name === name,
      (agent) => ({
        ...agent,
        tasksCompleted: (agent.tasksCompleted || 0) + 1
      })
    )
  }

  async updateSuccessRate(
    projectId: string,
    name: string,
    successRate: number
  ): Promise<AgentsSchema> {
    return this.updateAgent(projectId, name, { successRate })
  }
}

export const agentsManager = new AgentsManager()
export default agentsManager
