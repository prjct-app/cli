'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { Settings as SettingsIcon, CheckCircle, XCircle, Terminal, Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Settings() {
  const { theme, setTheme } = useTheme()

  const { data: claudeStatus } = useQuery({
    queryKey: ['claude-status'],
    queryFn: async () => {
      const res = await fetch('/api/claude/status')
      const json = await res.json()
      return json.data
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
