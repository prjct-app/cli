import { getProjectBgClass } from '@/lib/project-colors'

interface PageHeaderProps {
  projectId: string
  projectName: string
  section?: string
}

export function PageHeader({ projectId, projectName, section }: PageHeaderProps) {
  const colorBg = getProjectBgClass(projectId)

  return (
    <div className="flex items-center gap-3 mb-6">
      <div className={`w-3 h-3 rounded-full shrink-0 ${colorBg}`} />
      <h1 className="text-2xl font-semibold">{projectName}</h1>
      {section && (
        <>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-xl text-muted-foreground">{section}</span>
        </>
      )}
    </div>
  )
}
