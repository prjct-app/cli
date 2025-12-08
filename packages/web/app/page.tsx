'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { SessionsChart } from '@/components/charts/SessionsChart'

export default function Dashboard() {
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
    }
  })

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const projectCount = projects?.length || 0

  return (
    <div className="p-8 h-full overflow-auto">
      {/* Greeting */}
      <p className="text-muted-foreground">
        Hola! {stats?.userName || 'Developer'}
      </p>

      {/* Big Number - Grotesk */}
      <h1 className="text-8xl font-bold tracking-tighter tabular-nums mt-2">
        {projectCount}
      </h1>
      <p className="text-muted-foreground mt-1">
        {projectCount === 1 ? 'project' : 'projects'}
      </p>

      {/* Sessions Chart */}
      <section className="mt-8">
        <SessionsChart />
      </section>

      {/* Projects Grid */}
      <section className="mt-12">
        <h2 className="font-bold uppercase tracking-wide text-muted-foreground mb-6">
          Active Projects
        </h2>

        {projects?.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
            <p className="text-muted-foreground">
              No projects yet. Initialize with <code className="bg-muted px-2 py-1 rounded font-mono">/p:init</code>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects?.map((project: { id: string; name: string; path: string }) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
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
      href={`/project/${project.id}`}
      className="group block bg-card border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
    >
      <h3 className="font-bold">{project.name}</h3>
      <p className="text-muted-foreground mt-1">{project.id}</p>
    </Link>
  )
}
