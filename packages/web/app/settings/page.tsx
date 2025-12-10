'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { Settings as SettingsIcon, CheckCircle, XCircle, Terminal, Sun, Moon, Monitor, Key, Eye, EyeOff, Loader2, Trash2, RefreshCw, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const queryClient = useQueryClient()
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)

  const { data: claudeStatus } = useQuery({
    queryKey: ['claude-status'],
    queryFn: async () => {
      const res = await fetch('/api/claude/status')
      const json = await res.json()
      return json.data
    }
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      const json = await res.json()
      return json.data
    }
  })

  const saveKeyMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openRouterApiKey: key })
      })
      if (!res.ok) throw new Error('Failed to save')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setApiKey('')
    }
  })

  const deleteKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    }
  })

  const { data: projects } = useQuery({
    queryKey: ['migrate-projects'],
    queryFn: async () => {
      const res = await fetch('/api/migrate')
      const json = await res.json()
      return json.data?.projects || [] as { id: string; name: string }[]
    }
  })

  const [selectedProject, setSelectedProject] = useState<string>('')
  const [migrationResults, setMigrationResults] = useState<{
    success: boolean
    results: Array<{ file: string; success: boolean; error?: string }>
  } | null>(null)

  const migrateMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Migration failed')
      return json.data
    },
    onSuccess: (data) => {
      setMigrationResults(data)
    },
    onError: (error) => {
      setMigrationResults({
        success: false,
        results: [{ file: 'migration', success: false, error: error.message }]
      })
    }
  })

  return (
    <div className="p-6 h-full overflow-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" />
          Settings
        </h1>
      </header>

      <div className="space-y-6 max-w-2xl">
        {/* Appearance */}
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sun className="w-5 h-5" />
            Appearance
          </h2>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Choose how prjct looks to you. Select a single theme, or sync with your system settings.
              </p>
              <div className="flex gap-2">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('light')}
                  className="flex items-center gap-2"
                >
                  <Sun className="w-4 h-4" />
                  Light
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('dark')}
                  className="flex items-center gap-2"
                >
                  <Moon className="w-4 h-4" />
                  Dark
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('system')}
                  className="flex items-center gap-2"
                >
                  <Monitor className="w-4 h-4" />
                  System
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* OpenRouter API Key */}
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Key className="w-5 h-5" />
            OpenRouter API Key
          </h2>

          <p className="text-sm text-muted-foreground mb-4">
            Required for AI-powered features like MD→JSON migration. Get your key at{' '}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              openrouter.ai/keys
            </a>
          </p>

          {settings?.hasApiKey ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                <span className="text-sm font-mono">{settings.maskedKey}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => deleteKeyMutation.mutate()}
                  disabled={deleteKeyMutation.isPending}
                  className="ml-auto text-muted-foreground hover:text-destructive"
                >
                  {deleteKeyMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                API key is stored locally in ~/.prjct-cli/settings.json
              </p>

              {/* Data Migration Section - only shown when API key exists */}
              <div className="pt-4 border-t border-border">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Data Migration (MD → JSON)
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Convert markdown files to structured JSON using AI. This enables better parsing and querying.
                </p>

                <div className="flex gap-2 mb-3">
                  <select
                    value={selectedProject}
                    onChange={(e) => {
                      setSelectedProject(e.target.value)
                      setMigrationResults(null)
                    }}
                    className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="">Select a project...</option>
                    {(projects as { id: string; name: string }[] || []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <Button
                    onClick={() => selectedProject && migrateMutation.mutate(selectedProject)}
                    disabled={!selectedProject || migrateMutation.isPending}
                    size="sm"
                  >
                    {migrateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Sync
                      </>
                    )}
                  </Button>
                </div>

                {migrationResults && (
                  <div className={`p-3 rounded-md text-sm ${migrationResults.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                    <p className={`font-medium mb-2 ${migrationResults.success ? 'text-green-500' : 'text-red-500'}`}>
                      {migrationResults.success ? 'Migration complete!' : 'Migration had errors'}
                    </p>
                    <ul className="space-y-1 text-xs">
                      {migrationResults.results.map((r, i) => (
                        <li key={i} className="flex items-center gap-2">
                          {r.success ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-500" />
                          )}
                          <span>{r.file}</span>
                          {r.error && <span className="text-muted-foreground">- {r.error}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    placeholder="sk-or-v1-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  onClick={() => saveKeyMutation.mutate(apiKey)}
                  disabled={!apiKey || saveKeyMutation.isPending}
                >
                  {saveKeyMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
              {saveKeyMutation.isError && (
                <p className="text-sm text-destructive">Failed to save API key</p>
              )}
            </div>
          )}
        </section>

        {/* Claude Code Status */}
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Claude Code CLI
          </h2>

          <div className="flex items-center gap-3 mb-4">
            {claudeStatus?.available ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-green-500">Available</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-500">Not Found</span>
              </>
            )}
          </div>

          {claudeStatus?.version && (
            <p className="text-sm text-muted-foreground mb-4">
              Version: {claudeStatus.version}
            </p>
          )}

          <div className="bg-muted/50 rounded-md p-4 text-sm">
            <p className="font-medium mb-2">How it works:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>prjct uses Claude Code CLI via PTY (pseudo-terminal)</li>
              <li>Uses your existing Claude subscription (no API costs)</li>
              <li>Full Claude Code experience in your browser</li>
              <li>All tools work: Read, Write, Bash, etc.</li>
            </ul>
          </div>

          {!claudeStatus?.available && (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <p className="text-sm text-yellow-500">
                Install Claude Code CLI from{' '}
                <a
                  href="https://claude.ai/code"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  claude.ai/code
                </a>
              </p>
            </div>
          )}
        </section>

        {/* About */}
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">About prjct</h2>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">prjct</strong> is a developer momentum tool.
            </p>
            <p>
              Track progress, ship features, stay focused. Built for Claude.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Version 0.1.0 • Made with prjct.app
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
