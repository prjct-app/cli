import type { Metadata } from 'next'
import { getProject } from '@/lib/services/projects.server'
import { getProjectEmoji } from '@/lib/project-colors'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: projectId } = await params
  const project = await getProject(projectId)
  const projectName = project?.name ?? projectId
  const emoji = getProjectEmoji(projectId)

  return {
    title: `${emoji} ${projectName} / Code / p.`,
  }
}

export default function CodeLayout({ children }: { children: React.ReactNode }) {
  return children
}
