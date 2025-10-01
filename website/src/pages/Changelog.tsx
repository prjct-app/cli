import { motion } from 'framer-motion'
import { GitBranch, AlertTriangle, Plus, Wrench, Trash2, Shield, Users, Database, CheckCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export const Changelog = () => {
  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6">
            <GitBranch className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Version History</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Changelog
          </h1>
          <p className="text-xl text-muted-foreground">
            Track every improvement, feature, and change in prjct. We ship fast and iterate constantly.
          </p>
        </motion.div>

        {/* Version 0.2.0 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-16"
        >
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-3xl font-bold">v0.2.0</h2>
            <span className="px-3 py-1 bg-cat-red text-white text-sm font-medium rounded-full">
              Breaking Change
            </span>
            <span className="text-muted-foreground">September 30, 2025</span>
          </div>

          {/* Breaking Changes Alert */}
          <div className="mb-8 p-6 bg-cat-red/10 border-2 border-cat-red/30 rounded-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-cat-red flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-bold text-cat-red mb-2">Data Relocation Required</h3>
                <p className="text-muted-foreground mb-4">
                  <strong className="text-foreground">Important:</strong> This is a DATA RELOCATION, not deletion. ALL your data is preserved and moved to a better location.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-cat-green" />
                    <span>100% data preservation - every file, log, and timestamp</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-cat-green" />
                    <span>Automatic migration with validation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-cat-green" />
                    <span>Reversible process (.prjct/ kept as backup by default)</span>
                  </li>
                </ul>
                <Link
                  to="/docs/migration"
                  className="inline-flex items-center gap-2 mt-4 text-cat-red hover:underline font-medium"
                >
                  Read Migration Guide →
                </Link>
              </div>
            </div>
          </div>

          {/* Key Changes */}
          <div className="space-y-6">
            {/* Collaboration Feature */}
            <div className="p-6 bg-muted/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Collaboration-Ready Architecture</h3>
                  <p className="text-muted-foreground mb-3">
                    Designed for teams WITHOUT exposing personal data. Work together while keeping your velocity and notes private.
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• <code className="text-cat-mauve">.prjct/prjct.config.json</code> in project (safe to commit)</li>
                    <li>• Personal logs stay in <code className="text-cat-mauve">~/.prjct-cli/</code> (never committed)</li>
                    <li>• Author tracking enables future collaboration features</li>
                    <li>• Perfect for open source, remote teams, consulting</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Data Storage */}
            <div className="p-6 bg-muted/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Global Data Storage</h3>
                  <p className="text-muted-foreground mb-3">
                    Project data moved from <code className="text-cat-mauve">.prjct/</code> to <code className="text-cat-mauve">~/.prjct-cli/projects/[id]/</code>
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Prevents bundle size inflation</li>
                    <li>• No accidental commits of personal work logs</li>
                    <li>• Better privacy for productivity tracking</li>
                    <li>• Layered structure: core, progress, planning, analysis, memory</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Author Tracking */}
            <div className="p-6 bg-muted/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Author Detection & Tracking</h3>
                  <p className="text-muted-foreground mb-3">
                    All operations now include author information for collaboration readiness.
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Auto-detection via GitHub CLI (<code className="text-cat-mauve">gh api user</code>)</li>
                    <li>• Fallback to git config for name and email</li>
                    <li>• Every log entry includes author field</li>
                    <li>• Prepares for multi-user collaboration features</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Migration Guide CTA */}
          <div className="mt-8 p-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/20">
            <h3 className="text-xl font-bold mb-2">Need to Migrate?</h3>
            <p className="text-muted-foreground mb-4">
              Migrating from v0.1.0 is simple and safe. Zero data loss guaranteed.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/docs/migration"
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Read Migration Guide
              </Link>
              <a
                href="https://github.com/jlopezlira/prjct-cli"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-muted/50 rounded-lg font-medium hover:bg-muted transition-colors"
              >
                View on GitHub
              </a>
            </div>
          </div>

          {/* Technical Details */}
          <details className="mt-8 p-6 bg-muted/10 rounded-2xl cursor-pointer">
            <summary className="text-lg font-semibold mb-4">Technical Details & Full Changelog</summary>
            <div className="space-y-6 text-sm">
              {/* Added */}
              <div>
                <h4 className="font-bold text-cat-green mb-2 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Added
                </h4>
                <ul className="space-y-1 text-muted-foreground ml-6">
                  <li>• New core modules: path-manager, config-manager, author-detector, migrator</li>
                  <li>• Automatic migration system with integrity validation</li>
                  <li>• Project configuration system (prjct.config.json)</li>
                  <li>• Layered global storage structure</li>
                  <li>• Author tracking in all memory logs</li>
                </ul>
              </div>

              {/* Changed */}
              <div>
                <h4 className="font-bold text-cat-yellow mb-2 flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  Changed
                </h4>
                <ul className="space-y-1 text-muted-foreground ml-6">
                  <li>• Data location: .prjct/ → ~/.prjct-cli/projects/[id]/</li>
                  <li>• Memory logs now include author field</li>
                  <li>• File structure organized into layers</li>
                  <li>• Initialization creates global structure and config</li>
                </ul>
              </div>

              {/* Removed */}
              <div>
                <h4 className="font-bold text-cat-red mb-2 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Removed
                </h4>
                <ul className="space-y-1 text-muted-foreground ml-6">
                  <li>• Local .prjct/ directory usage (replaced with global storage)</li>
                  <li>• Legacy flat file structure (replaced with layered architecture)</li>
                </ul>
              </div>
            </div>
          </details>
        </motion.section>

        {/* Version 0.1.0 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-3xl font-bold">v0.1.0</h2>
            <span className="px-3 py-1 bg-primary text-primary-foreground text-sm font-medium rounded-full">
              Initial Release
            </span>
            <span className="text-muted-foreground">January 2024</span>
          </div>

          <div className="p-6 bg-muted/20 rounded-2xl">
            <h3 className="text-xl font-bold mb-4">Initial Release Features</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Core Commands</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• /p:init - Initialize project</li>
                  <li>• /p:now - Set current task</li>
                  <li>• /p:done - Complete task</li>
                  <li>• /p:ship - Celebrate wins</li>
                  <li>• /p:recap - Project overview</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Features</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• AI-integrated workflow</li>
                  <li>• Claude Code support</li>
                  <li>• OpenAI Codex support</li>
                  <li>• Terminal compatibility</li>
                  <li>• Automatic environment detection</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Stay Updated */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="p-8 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl border border-primary/20 text-center"
        >
          <h3 className="text-2xl font-bold mb-2">Stay Updated</h3>
          <p className="text-muted-foreground mb-6">
            Follow our GitHub repository for the latest updates and releases.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://github.com/jlopezlira/prjct-cli/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              View All Releases
            </a>
            <a
              href="https://github.com/jlopezlira/prjct-cli"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-muted/50 rounded-lg font-medium hover:bg-muted transition-colors"
            >
              Star on GitHub
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
