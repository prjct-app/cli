import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
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
      {/* Header with back navigation */}
      <div className="pl-10 md:pl-0 mb-6">
        <Link
          href={`/project/${projectId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {projectName}
        </Link>
        <h1 className="text-3xl font-bold">Weekly Reports</h1>
      </div>

      <div className="pl-10 md:pl-0">
        <WeeklyReports stats={stats} projectName={projectName} />
      </div>
      <div className="h-4" />
    </div>
  )
}
