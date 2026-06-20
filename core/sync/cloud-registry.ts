/**
 * Cloud-linked project registry — a tiny durable list of the projects that
 * have run `prjct cloud link`, so the daemon can reopen their realtime
 * connections on boot WITHOUT scanning every project on disk (a machine can
 * have thousands of project dirs; only a handful are ever linked).
 *
 * Stored at `<state>/cloud-linked.json`. `link` adds, `unlink` removes. Paused
 * state is NOT tracked here — that lives in each project's config and is read
 * per-project by the realtime manager (the list is small).
 */

import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import * as fileHelper from '../utils/file-helper'

export interface LinkedProject {
  projectId: string
  projectPath: string
}

function registryPath(): string {
  return path.join(pathManager.getStatePath(), 'cloud-linked.json')
}

export async function listLinkedProjects(): Promise<LinkedProject[]> {
  const data = await fileHelper.readJson<LinkedProject[]>(registryPath(), [])
  return Array.isArray(data) ? data.filter((p) => p?.projectId && p?.projectPath) : []
}

export async function addLinkedProject(projectId: string, projectPath: string): Promise<void> {
  const list = await listLinkedProjects()
  const next = list.filter((p) => p.projectId !== projectId)
  next.push({ projectId, projectPath })
  await fileHelper.ensureDir(pathManager.getStatePath())
  await fileHelper.writeJson(registryPath(), next)
}

export async function removeLinkedProject(projectId: string): Promise<void> {
  const list = await listLinkedProjects()
  await fileHelper.ensureDir(pathManager.getStatePath())
  await fileHelper.writeJson(
    registryPath(),
    list.filter((p) => p.projectId !== projectId)
  )
}
