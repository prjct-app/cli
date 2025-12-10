import { getProjects } from '@/lib/services/projects.server'
import { getGlobalStats } from '@/lib/services/stats.server'
import { DashboardContent } from '@/components/DashboardContent'

export default async function Dashboard() {
  const [projects, stats] = await Promise.all([
    getProjects(),
    getGlobalStats()
  ])

  return <DashboardContent projects={projects} stats={stats} />
}
