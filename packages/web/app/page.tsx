import { getProjects } from '@/lib/services/projects.server'
import { getGlobalStats } from '@/lib/services/stats.server'
import { DashboardContent } from '@/components/DashboardContent'
import { MigrationGate } from '@/components/MigrationGate'

export default async function Dashboard() {
  const [projects, stats] = await Promise.all([
    getProjects(),
    getGlobalStats()
  ])

  return (
    <MigrationGate>
      <DashboardContent projects={projects} stats={stats} />
    </MigrationGate>
  )
}
