import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getStats } from '@/lib/services/stats.server'
import { getProject } from '@/lib/services/projects.server'
import { getProjectEmoji } from '@/lib/project-colors'
import { WeeklyReports } from '@/components/WeeklyReports'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: projectId } = await params
  const project = await getProject(projectId)
  const projectName = project?.name ?? projectId
  const emoji = getProjectEmoji(projectId)

  return {
    title: `${emoji} ${projectName} / Reports / p.`,
  }
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ReportsPage({ params }: PageProps) {
  const { id: projectId } = await params

  const [project, stats] = await Promise.all([
    getProject(projectId),
    getStats(projectId)
  ])

  if (!stats.hasData) {
    notFound()
  }

  const projectName = project?.name ?? projectId

  return (
    <div className="flex h-full flex-col p-4 md:p-6 overflow-auto">
      <div className="pl-10 md:pl-0">
        <WeeklyReports stats={stats} projectName={projectName} />
      </div>
      <div className="h-4" />
    </div>
  )
}
