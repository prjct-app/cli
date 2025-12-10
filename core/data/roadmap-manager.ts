/**
 * Roadmap Manager
 *
 * Manages roadmap.json - feature roadmap.
 */

import { ArrayManager } from './base-manager'
import type {
  FeatureSchema,
  RoadmapSchema,
  FeatureStatus,
  FeatureTask
} from '../schemas'
import { DEFAULT_FEATURE } from '../schemas'

class RoadmapManager extends ArrayManager<FeatureSchema> {
  constructor() {
    super('roadmap.json')
  }

  async getFeatures(projectId: string): Promise<RoadmapSchema> {
    return this.read(projectId)
  }

  async getActiveFeatures(projectId: string): Promise<RoadmapSchema> {
    const features = await this.read(projectId)
    return features.filter((f) => f.status === 'in_progress')
  }

  async getFeature(projectId: string, id: string): Promise<FeatureSchema | undefined> {
    return this.find(projectId, (feature) => feature.id === id)
  }

  async addFeature(
    projectId: string,
    name: string,
    options?: Partial<Omit<FeatureSchema, 'id' | 'name' | 'createdAt'>>
  ): Promise<RoadmapSchema> {
    const feature: FeatureSchema = {
      ...DEFAULT_FEATURE,
      ...options,
      id: `feature_${Date.now()}`,
      name,
      createdAt: new Date().toISOString()
    }
    return this.add(projectId, feature)
  }

  async updateFeature(
    projectId: string,
    id: string,
    updates: Partial<Omit<FeatureSchema, 'id' | 'createdAt'>>
  ): Promise<RoadmapSchema> {
    return this.updateItem(
      projectId,
      (feature) => feature.id === id,
      (feature) => ({ ...feature, ...updates })
    )
  }

  async setStatus(
    projectId: string,
    id: string,
    status: FeatureStatus
  ): Promise<RoadmapSchema> {
    const updates: Partial<FeatureSchema> = { status }
    if (status === 'completed' || status === 'shipped') {
      updates.completedAt = new Date().toISOString()
    }
    return this.updateFeature(projectId, id, updates)
  }

  async addTask(
    projectId: string,
    featureId: string,
    task: FeatureTask
  ): Promise<RoadmapSchema> {
    return this.updateItem(
      projectId,
      (feature) => feature.id === featureId,
      (feature) => ({
        ...feature,
        tasks: [...feature.tasks, task]
      })
    )
  }

  async completeTask(
    projectId: string,
    featureId: string,
    taskIndex: number
  ): Promise<RoadmapSchema> {
    return this.updateItem(
      projectId,
      (feature) => feature.id === featureId,
      (feature) => ({
        ...feature,
        tasks: feature.tasks.map((task, i) =>
          i === taskIndex ? { ...task, completed: true } : task
        )
      })
    )
  }

  async removeFeature(projectId: string, id: string): Promise<RoadmapSchema> {
    return this.remove(projectId, (feature) => feature.id === id)
  }

  async getProgress(projectId: string, featureId: string): Promise<number> {
    const feature = await this.getFeature(projectId, featureId)
    if (!feature || feature.tasks.length === 0) return 0
    const completed = feature.tasks.filter((t) => t.completed).length
    return Math.round((completed / feature.tasks.length) * 100)
  }
}

export const roadmapManager = new RoadmapManager()
export default roadmapManager
