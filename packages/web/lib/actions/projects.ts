'use server'

import { revalidatePath } from 'next/cache'
import { moveToTrash } from '@/lib/projects'

export async function deleteProject(projectId: string) {
  try {
    const result = await moveToTrash(projectId)
    revalidatePath('/')
    return { success: true, ...result }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete project'
    return { success: false, error: message }
  }
}
