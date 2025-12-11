'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Circle, Loader2, Key, Package, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProjectInfo {
  id: string
  name: string
  needsMigration: boolean
}

interface MigrationResult {
  file: string
  success: boolean
  error?: string
}

type Status = 'checking' | 'needs-key' | 'needs-migration' | 'migrating' | 'ready'

interface MigrationGateProps {
  children: React.ReactNode
}

export function MigrationGate({ children }: MigrationGateProps) {
  const [status, setStatus] = useState<Status>('checking')
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [apiKey, setApiKey] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [migratingProject, setMigratingProject] = useState<string | null>(null)
  const [migrationResults, setMigrationResults] = useState<Record<string, MigrationResult[]>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkStatus()
  }, [])

  async function checkStatus() {
    try {
      // 1. Check API key
      const settingsRes = await fetch('/api/settings')
      const settings = await settingsRes.json()

      if (!settings.data?.hasApiKey) {
        setStatus('needs-key')
        return
      }

      // 2. Check projects needing migration
      const migrateRes = await fetch('/api/migrate')
      const migrate = await migrateRes.json()

      if (migrate.data?.projects?.length > 0) {
        setProjects(migrate.data.projects.map((p: { id: string; name: string }) => ({
          ...p,
          needsMigration: true
        })))
        setStatus('needs-migration')
        return
      }

      setStatus('ready')
    } catch (err) {
      console.error('Error checking migration status:', err)
      // On error, just show the dashboard
      setStatus('ready')
    }
  }

  async function saveApiKey() {
    if (!apiKey.trim()) return

    setSavingKey(true)
    setError(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openRouterApiKey: apiKey.trim() })
      })

      const data = await res.json()

      if (data.success) {
        setApiKey('')
        await checkStatus() // Re-check, might need migration now
      } else {
        setError(data.error || 'Failed to save API key')
      }
    } catch (err) {
      setError('Failed to save API key')
    } finally {
      setSavingKey(false)
    }
  }

  async function migrateProject(projectId: string) {
    setMigratingProject(projectId)
    setError(null)

    try {
      const res = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      })

      const data = await res.json()

      if (data.success && data.data?.success) {
        // Mark project as migrated
        setProjects(prev => prev.map(p =>
          p.id === projectId ? { ...p, needsMigration: false } : p
        ))
        setMigrationResults(prev => ({
          ...prev,
          [projectId]: data.data.results
        }))

        // Check if all done
        const remaining = projects.filter(p => p.id !== projectId && p.needsMigration)
        if (remaining.length === 0) {
          setTimeout(() => setStatus('ready'), 1000)
        }
      } else {
        setError(data.error || data.data?.error || 'Migration failed')
        setMigrationResults(prev => ({
          ...prev,
          [projectId]: data.data?.results || []
        }))
      }
    } catch (err) {
      setError('Migration request failed')
    } finally {
      setMigratingProject(null)
    }
  }

  async function migrateAll() {
    const toMigrate = projects.filter(p => p.needsMigration)
    for (const project of toMigrate) {
      await migrateProject(project.id)
    }
  }

  // Ready - show dashboard
  if (status === 'ready') {
    return <>{children}</>
  }

  // Loading
  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Checking migration status...</p>
        </div>
      </div>
    )
  }

  // Needs API Key
  if (status === 'needs-key') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Key className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>OpenRouter API Key Required</CardTitle>
            <CardDescription>
              prjct needs an OpenRouter API key to migrate your projects to the new JSON format.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="sk-or-v1-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveApiKey()}
              />
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                Get your key at openrouter.ai/keys
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              onClick={saveApiKey}
              disabled={!apiKey.trim() || savingKey}
              className="w-full"
            >
              {savingKey ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Key'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Needs Migration
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Migration Required</CardTitle>
          <CardDescription>
            The following projects need to be migrated to the new JSON format.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg divide-y">
            {projects.map((project) => {
              const isMigrating = migratingProject === project.id
              const results = migrationResults[project.id]
              const isMigrated = !project.needsMigration

              return (
                <div key={project.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {isMigrated ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    ) : isMigrating ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <span className={cn(
                      "truncate",
                      isMigrated && "text-muted-foreground"
                    )}>
                      {project.name}
                    </span>
                  </div>

                  {isMigrated ? (
                    <span className="text-sm text-green-600">Migrated</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => migrateProject(project.id)}
                      disabled={!!migratingProject}
                    >
                      {isMigrating ? 'Migrating...' : 'Migrate'}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {projects.some(p => p.needsMigration) && (
            <Button
              onClick={migrateAll}
              disabled={!!migratingProject}
              className="w-full"
            >
              {migratingProject ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Migrating...
                </>
              ) : (
                'Migrate All'
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
