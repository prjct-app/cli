import { notFound } from 'next/navigation'
import { getStats } from '@/lib/services/stats.server'
import { getProject } from '@/lib/services/projects.server'
import { WeeklyReports } from '@/components/WeeklyReports'

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
      {/* Mobile: Add padding for hamburger menu */}
      <div className="pl-10 md:pl-0">
        <WeeklyReports stats={stats} projectName={projectName} />
      </div>
      <div className="h-4" />
    </div>
  )
}
