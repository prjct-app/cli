import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  Target,
  GitCommit,
  FileCode,
  TrendingUp,
  Play
} from 'lucide-react'
import { Link } from 'react-router-dom'

export function Dashboard() {
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      const json = await res.json()
      return json.data || []
    }
  })

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats')
      const json = await res.json()
      return json.data
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 h-full overflow-auto">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Ship fast, track progress, stay focused.
        </p>
      </header>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Target}
          label="Active Sessions"
          value={String(stats?.activeSessions || 0)}
          trend={`${stats?.today?.completed || 0} completed today`}
        />
        <StatCard
          icon={Clock}
          label="Time Today"
          value={stats?.today?.timeFormatted || '0h'}
          trend={`${stats?.today?.sessions || 0} sessions`}
        />
        <StatCard
          icon={GitCommit}
          label="Commits"
          value={String(stats?.week?.commits || 0)}
          trend="this week"
        />
        <StatCard
          icon={FileCode}
          label="Projects"
          value={String(stats?.totalProjects || projects?.length || 0)}
          trend="total"
        />
      </div>

      {/* Projects Grid */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Projects</h2>

        {projects?.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground">
              No projects yet. Initialize a project with <code className="bg-muted px-2 py-1 rounded">/p:init</code>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects?.map((project: any) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  trend: string
}

function StatCard({ icon: Icon, label, value, trend }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />
        {trend}
      </div>
    </div>
  )
}

interface ProjectCardProps {
  project: {
    id: string
    name: string
    path: string
  }
}

function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      to={`/project/${project.id}`}
      className="block bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium">{project.name}</h3>
          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
            {project.id}
          </p>
        </div>
        <div
          className="p-2 rounded-md hover:bg-accent transition-colors"
          title="Open Project"
        >
          <Play className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          0h today
        </span>
        <span className="flex items-center gap-1">
          <GitCommit className="w-3 h-3" />
          0 commits
        </span>
      </div>
    </Link>
  )
}
