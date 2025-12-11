import type { Metadata } from 'next'
import { getStats } from '@/lib/services/stats.server'
import { getProject } from '@/lib/projects'
import { getProjectEmoji } from '@/lib/project-colors'
import { PrintableReport } from '@/components/WeeklyReports/PrintableReport'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: projectId } = await params
  const project = await getProject(projectId)
  const projectName = project?.name ?? projectId
  const emoji = getProjectEmoji(projectId)

  return {
    title: `${emoji} ${projectName} / Print / p.`,
  }
}

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ weeks?: string; year?: string }>
}

export default async function PrintReportPage({ params, searchParams }: Props) {
  const { id } = await params
  const { weeks, year } = await searchParams

  const project = await getProject(id)
  if (!project) {
    return <div className="p-8 text-center">Project not found</div>
  }

  const stats = await getStats(id)

  // Parse weeks from query params (comma-separated)
  const selectedWeeks = weeks
    ? weeks.split(',').map(Number).filter(n => !isNaN(n))
    : [getCurrentWeek()]

  const selectedYear = year ? parseInt(year) : new Date().getFullYear()

  return (
    <PrintableReport
      stats={stats}
      projectName={project.name}
      selectedWeeks={selectedWeeks}
      year={selectedYear}
    />
  )
}

function getCurrentWeek(): number {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
