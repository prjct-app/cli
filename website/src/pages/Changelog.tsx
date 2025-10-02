import { motion } from 'framer-motion'
import { GitBranch, AlertTriangle, Plus, Wrench, Trash2, Shield, Users, Database, CheckCircle, Monitor } from 'lucide-react'
import { Link } from 'react-router-dom'
import { VersionHeader } from '@/components/changelog/VersionHeader'
import { FeatureCard } from '@/components/changelog/FeatureCard'
import { TechnicalDetails } from '@/components/changelog/TechnicalDetails'

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

        {/* Unreleased - Coming Soon */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-16"
        >
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-3xl font-bold">Unreleased</h2>
            <span className="px-3 py-1 bg-cat-blue text-white text-sm font-medium rounded-full">
              Coming Soon
            </span>
          </div>

          <div className="space-y-6">
            <FeatureCard
              icon={Monitor}
              title="Windows Compatibility"
              description="Native Windows support for prjct-cli"
              bullets={[
                '• PowerShell and CMD command execution',
                <>• Windows path handling (<code className="text-cat-mauve">%USERPROFILE%\.prjct-cli\</code>)</>,
                '• Windows-specific installation scripts',
                '• Cross-platform file operations',
                '• Windows Terminal integration'
              ]}
            />
          </div>
        </motion.section>

        {/* Version 0.4.1 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <VersionHeader version="v0.4.1" date="October 1, 2025" isLatest />

          <div className="space-y-6 mb-6">
            <FeatureCard
              icon={Plus}
              title="Automatic Update Detection"
              description="Built-in update checker that notifies users when new versions are available"
              bullets={[
                '• Checks npm registry every 24 hours for new versions',
                '• Non-blocking background check during command execution',
                '• Formatted notification with update command',
                '• Shows only once per session to avoid notification spam',
                '• Respects 24-hour cache to minimize npm registry requests'
              ]}
            />

            <FeatureCard
              icon={Shield}
              title="Automated npm Publication"
              description="GitHub Actions workflow for automatic npm publishing with OIDC security"
              bullets={[
                '• Triggered on version tags (v*)',
                '• Automatic version verification against package.json',
                '• Provenance publishing with npm attestation',
                '• OIDC Trusted Publisher authentication (no tokens)',
                '• Post-publication verification',
                '• Publication summary in GitHub Actions'
              ]}
            />

            <FeatureCard
              icon={Wrench}
              title="Simplified Installation"
              description="npm is now the primary and recommended installation method"
              bullets={[
                <>• Single installation method: <code className="text-cat-mauve">npm install -g prjct-cli</code></>,
                '• Removed Homebrew and Bun installation scripts',
                '• Cleaner package with optimized file inclusion',
                '• Reduced package size: 104.6 KB (71 files)'
              ]}
            />

            <FeatureCard
              icon={Database}
              title="Package Structure Fixes"
              bullets={[
                <>• Added <code className="text-cat-mauve">files</code> field to control package contents</>,
                <>• Created <code className="text-cat-mauve">.npmignore</code> for development file exclusion</>,
                <>• Proper global data directory separation (<code className="text-cat-mauve">~/.prjct-cli/</code> for data only)</>,
                '• Fixed CI/CD tests to verify CLI functionality instead of individual modules'
              ]}
            />
          </div>

          <TechnicalDetails
            details={[
              <>• <strong>Update Checker</strong>: <code className="text-cat-mauve">core/update-checker.js</code> with semantic version comparison</>,
              <>• <strong>Cache Management</strong>: Update checks cached for 24 hours in <code className="text-cat-mauve">~/.prjct-cli/config/update-cache.json</code></>,
              <>• <strong>Architecture</strong>: Clean separation between npm installation and user data</>,
              <>• <strong>GitHub Actions</strong>: <code className="text-cat-mauve">.github/workflows/publish-npm.yml</code> for automated publication</>
            ]}
          />
        </motion.section>

        {/* Version 0.4.0 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-16"
        >
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-3xl font-bold">v0.4.0</h2>
            <span className="text-muted-foreground">October 1, 2025</span>
          </div>

          {/* Interactive Workflow System */}
          <div className="space-y-6 mb-6">
            <div className="relative isolate overflow-visible">
              <div className="fancy-border pointer-events-none"></div>
              <div className="relative z-10 p-6 bg-black rounded-2xl border border-border">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Interactive Workflow System</h3>
                    <p className="text-muted-foreground mb-3">
                      Intelligent agent workflows with user-guided capability installation. Workflows detect missing capabilities and prompt users for decisions instead of auto-skipping steps.
                    </p>

                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• <strong>Adaptive Workflows</strong>: Detect missing capabilities and prompt user for install/skip/continue/pause decisions</li>
                      <li>• <strong>Smart Recommendations</strong>: Stack-aware tool suggestions (React → Vitest, Vue → Vitest, Angular → Jest)</li>
                      <li>• <strong>Installation Tracking</strong>: Every tool installation becomes a visible, tracked workflow task with duration</li>
                      <li>• <strong>Interactive Prompts</strong>: Never auto-skips steps - always asks user for decisions</li>
                      <li>• <strong>Capability Detection</strong>: Automatically detects design systems, test frameworks, and documentation tools</li>
                      <li>• <strong>Auto-Configuration</strong>: Installed tools are automatically configured with framework-specific settings</li>
                      <li>• <strong>Workflow Types</strong>: UI, API, Bug Fix, Refactor, and Feature workflows with specialized agent assignments</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* New Core Modules */}
            <div className="p-6 bg-muted/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">New Core Modules</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• <code className="text-cat-mauve">core/workflow-engine.js</code>: Orchestrates adaptive workflows with step management</li>
                    <li>• <code className="text-cat-mauve">core/workflow-rules.js</code>: Defines workflow pipelines by task type</li>
                    <li>• <code className="text-cat-mauve">core/workflow-prompts.js</code>: Interactive prompting engine with stack detection</li>
                    <li>• <code className="text-cat-mauve">core/capability-installer.js</code>: Handles tool installation, configuration, and verification</li>
                    <li>• <code className="text-cat-mauve">core/project-capabilities.js</code>: Detects existing project capabilities (design/test/docs)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Enhanced Commands */}
            <div className="p-6 bg-muted/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Enhanced Commands</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• <code className="text-cat-mauve">workflowRespond(choice)</code>: Handle user responses to workflow prompts</li>
                    <li>• Enhanced <code className="text-cat-mauve">done()</code>: Checks for prompts, advances workflows intelligently</li>
                    <li>• Enhanced <code className="text-cat-mauve">idea()</code>: Auto-initializes workflows for actionable tasks</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Details */}
          <details className="mt-8 p-6 bg-muted/10 rounded-2xl cursor-pointer">
            <summary className="text-lg font-semibold mb-4">Technical Details</summary>
            <div className="space-y-6 text-sm">
              <div>
                <h4 className="font-bold text-cat-green mb-2">Stack Detection</h4>
                <ul className="space-y-1 text-muted-foreground ml-6">
                  <li>• Identifies React/Vue/Angular, TypeScript, bundler (Vite/Webpack/esbuild)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-cat-green mb-2">Tool Recommendations</h4>
                <ul className="space-y-1 text-muted-foreground ml-6">
                  <li>• React + TS → Vitest + Testing Library</li>
                  <li>• Vue → Vitest + @vue/test-utils</li>
                  <li>• Angular → Jest + @types/jest</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-cat-green mb-2">Auto-Configuration</h4>
                <ul className="space-y-1 text-muted-foreground ml-6">
                  <li>• Creates config files (vitest.config.js, jest.config.js, jsdoc.json)</li>
                  <li>• Updates package.json scripts</li>
                  <li>• Verifies installation success</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-cat-yellow mb-2">Workflow Behavior Changes</h4>
                <ul className="space-y-1 text-muted-foreground ml-6">
                  <li>• Before: Missing capability → auto-skip step</li>
                  <li>• After: Missing capability → prompt user → track installation → continue</li>
                  <li>• Duration tracking: Installation tasks show completion time (e.g., "1.2 min")</li>
                  <li>• All workflow steps tracked with status, duration, and metadata</li>
                </ul>
              </div>
            </div>
          </details>
        </motion.section>

        {/* Version 0.3.2 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-16"
        >
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-3xl font-bold">v0.3.2</h2>
            <span className="text-muted-foreground">October 1, 2025</span>
          </div>

          {/* Interactive Installation Compatibility */}
          <div className="space-y-6 mb-6">
            <div className="p-6 bg-muted/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-cat-green/20 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-5 h-5 text-cat-green" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Interactive Installation Compatibility</h3>
                  <p className="text-muted-foreground mb-3">
                    Fixed interactive editor selection failing due to inquirer library ESM compatibility issues.
                  </p>

                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Replaced inquirer v12 with prompts v2.4.2 for better CommonJS compatibility</li>
                    <li>• Fixed "inquirer.prompt is not a function" and "createPromptModule is not a function" errors</li>
                    <li>• inquirer v12 required complex ESM dynamic imports that were causing runtime failures</li>
                    <li>• prompts provides simpler API with native CommonJS support</li>
                    <li>• Reduced package count from 68 to 40 dependencies</li>
                    <li>• Interactive UI now works reliably across all Node.js versions</li>
                    <li>• Updated <code className="text-cat-mauve">scripts/interactive-install.js</code> and <code className="text-cat-mauve">core/command-installer.js</code></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Version 0.3.1 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-16"
        >
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-3xl font-bold">v0.3.1</h2>
            <span className="text-muted-foreground">October 1, 2025</span>
          </div>

          {/* Installation Path Fix */}
          <div className="space-y-6 mb-6">
            <div className="p-6 bg-muted/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-cat-green/20 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-5 h-5 text-cat-green" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Installation Path Resolution Fix</h3>
                  <p className="text-muted-foreground mb-3">
                    Fixed critical installation error that prevented users from installing prjct-cli via curl.
                  </p>

                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Fixed "setup.sh: No such file or directory" error during installation (<a href="https://github.com/jlopezlira/prjct-cli/issues/11" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">#11</a>)</li>
                    <li>• Corrected path resolution in <code className="text-cat-mauve">docs/install.sh</code>, <code className="text-cat-mauve">scripts/install.sh</code>, and <code className="text-cat-mauve">scripts/setup.sh</code></li>
                    <li>• Added verification tests in <code className="text-cat-mauve">tests/verify-install-paths.sh</code></li>
                    <li>• Added comprehensive documentation in <code className="text-cat-mauve">tests/INSTALL_PATH_FIX.md</code></li>
                    <li>• Thanks to <a href="https://github.com/danrocha" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@danrocha</a> for reporting the issue</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Version 0.3.0 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-16"
        >
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-3xl font-bold">v0.3.0</h2>
            <span className="text-muted-foreground">September 30, 2025</span>
          </div>

          {/* Intelligent Codebase Analysis */}
          <div className="space-y-6 mb-6">
            <div className="p-6 bg-muted/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Intelligent Codebase Analysis & Sync</h3>
                  <p className="text-muted-foreground mb-3">
                    Auto-detect implemented features and sync project state. Perfect for teams working without cloud storage.
                  </p>

                  <div className="space-y-3 mb-4">
                    <div className="p-3 bg-background/50 rounded-lg border border-border">
                      <code className="text-cat-mauve text-sm">/p:analyze</code>
                      <p className="text-xs text-muted-foreground mt-1">
                        Analyze codebase and detect implemented commands/features
                      </p>
                    </div>

                    <div className="p-3 bg-background/50 rounded-lg border border-border">
                      <code className="text-cat-mauve text-sm">/p:analyze --sync</code>
                      <p className="text-xs text-muted-foreground mt-1">
                        Automatically update .prjct/ files with real implementation state
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Auto-execution during <code className="text-cat-mauve">/p:init</code> when cloning repos with existing code</li>
                    <li>• Detects implemented commands by scanning source files</li>
                    <li>• Extracts completed features from git history, dependencies, and directory structure</li>
                    <li>• Automatically updates <code className="text-cat-mauve">next.md</code> by marking completed tasks</li>
                    <li>• Adds detected features to <code className="text-cat-mauve">shipped.md</code></li>
                    <li>• Generates detailed analysis reports in <code className="text-cat-mauve">analysis/repo-summary.md</code></li>
                    <li>• Prevents duplicate work across team members</li>
                    <li>• Real project status visibility without cloud sync</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Interactive Editor Selection */}
            <div className="p-6 bg-muted/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Interactive Editor Selection</h3>
                  <p className="text-muted-foreground mb-3">
                    Choose which AI editors to install commands to via interactive checkboxes
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Interactive checkbox UI during <code className="text-cat-mauve">prjct install</code> and <code className="text-cat-mauve">prjct init</code></li>
                    <li>• Detects all installed editors (Claude Code, Cursor, Codex, Windsurf)</li>
                    <li>• Shows installation paths for each detected editor</li>
                    <li>• Allows users to select only the editors they use</li>
                    <li>• <code className="text-cat-mauve">--no-interactive</code> flag to install to all detected editors without prompts</li>
                    <li>• Optimizes installation by avoiding unnecessary editor installations</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Updated Branding */}
            <div className="p-6 bg-muted/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Updated Branding</h3>
                  <p className="text-muted-foreground mb-3">
                    New header design with kaomoji (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Refreshed README.md header with fun, friendly design</li>
                    <li>• Updated installer (scripts/install.sh) to match new branding</li>
                    <li>• Consistent visual identity across documentation and installation experience</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Version 0.2.1 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-3xl font-bold">v0.2.1</h2>
            <span className="text-muted-foreground">September 30, 2025</span>
          </div>

          {/* Key Features */}
          <div className="space-y-6">
            {/* Multi-Editor Support */}
            <div className="p-6 bg-muted/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Multi-Editor Command Installation</h3>
                  <p className="text-muted-foreground mb-3">
                    Automatic slash command deployment across AI editors with seamless synchronization.
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• <code className="text-cat-mauve">prjct install</code> command for all detected editors</li>
                    <li>• Support for Claude Code, Cursor AI, and Codeium</li>
                    <li>• Template-based command system in <code className="text-cat-mauve">~/.prjct-cli/templates/</code></li>
                    <li>• Automatic installation during <code className="text-cat-mauve">prjct init</code></li>
                    <li>• Cross-editor data synchronization through global architecture</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Global Migration */}
            <div className="p-6 bg-muted/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Global Migration System</h3>
                  <p className="text-muted-foreground mb-3">
                    Migrate all legacy projects on your machine with a single command.
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• <code className="text-cat-mauve">prjct migrate-all</code> finds and migrates all legacy projects</li>
                    <li>• Scans common directories: <code className="text-cat-mauve">~/Projects</code>, <code className="text-cat-mauve">~/Documents</code>, etc.</li>
                    <li>• Optional <code className="text-cat-mauve">--deep-scan</code> for entire home directory</li>
                    <li>• <code className="text-cat-mauve">--dry-run</code> to preview changes</li>
                    <li>• <code className="text-cat-mauve">--remove-legacy</code> to clean up after migration</li>
                    <li>• Progress tracking and comprehensive reports</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Repository Reorganization */}
            <div className="p-6 bg-muted/20 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Repository Structure Reorganization</h3>
                  <p className="text-muted-foreground mb-3">
                    Cleaner project structure with better organization and clarity.
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Source code moved to <code className="text-cat-mauve">src/</code> directory</li>
                    <li>• Scripts organized in <code className="text-cat-mauve">scripts/</code></li>
                    <li>• Configuration in <code className="text-cat-mauve">.config/</code></li>
                    <li>• Renamed <code className="text-cat-mauve">lp/</code> to <code className="text-cat-mauve">website/</code> for clarity</li>
                    <li>• Added <code className="text-cat-mauve">templates/commands/</code> for command distribution</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Version 0.2.0 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
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
          transition={{ duration: 0.6, delay: 0.8 }}
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
          transition={{ duration: 0.6, delay: 0.9 }}
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
