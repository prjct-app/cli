import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Users,
  Database,
  Shield,
  Sparkles,
  GitBranch,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { BackToDocsButton } from '../../components/BackToDocsButton'

export const Migration = () => {
  return (
    <div className="min-h-screen px-4 py-20">
      <div className="mx-auto max-w-4xl">
        {/* Back Button */}
        <BackToDocsButton />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Migration Guide</span>
          </div>
          <h1 className="mb-6 text-5xl font-bold md:text-6xl">Migration Guide</h1>
          <p className="text-xl text-muted-foreground">Jump to your migration path:</p>
          <div className="mt-4 flex flex-col gap-2">
            <a href="#v050" className="font-medium text-primary hover:underline">
              → v0.4.x → v0.5.0 (Upgrading to Build for Claude) 🆕
            </a>
            <a href="#v021" className="font-medium text-primary hover:underline">
              → v0.1.0 → v0.2.1 (Data Architecture Change)
            </a>
          </div>
        </motion.div>

        {/* v0.5.0 Migration */}
        <motion.section
          id="v050"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-16"
        >
          <h2 className="mb-6 text-4xl font-bold">Upgrading to Build for Claude (v0.5.0)</h2>
          <p className="mb-8 text-xl text-muted-foreground">
            Ship fast, no BS - prjct-cli is now 100% Claude-focused.
          </p>

          {/* Breaking Change Alert */}
          <div className="mb-8 rounded-2xl border-2 border-cat-red/30 bg-cat-red/10 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 h-6 w-6 flex-shrink-0 text-cat-red" />
              <div>
                <h3 className="mb-2 text-xl font-bold text-cat-red">Breaking Change</h3>
                <p className="text-muted-foreground">
                  Starting with v0.5.0, prjct-cli{' '}
                  <strong>only supports Claude Code and Claude Desktop</strong>. Support for Cursor,
                  Windsurf, and OpenAI Codex has been removed.
                </p>
              </div>
            </div>
          </div>

          {/* Why Claude-Only */}
          <div className="mb-8 rounded-2xl bg-muted/20 p-6">
            <h3 className="mb-4 text-2xl font-bold">Why Claude-Only?</h3>
            <p className="mb-4 text-muted-foreground">We chose to focus 100% on Claude because:</p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <span className="text-xs font-bold text-primary">1</span>
                </div>
                <div>
                  <strong className="text-foreground">Better Quality</strong>
                  <p className="text-sm text-muted-foreground">
                    Optimize for Claude's unique capabilities (MCP, agents, natural language)
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <span className="text-xs font-bold text-primary">2</span>
                </div>
                <div>
                  <strong className="text-foreground">Faster Development</strong>
                  <p className="text-sm text-muted-foreground">
                    50-60% less code = faster features and bug fixes
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <span className="text-xs font-bold text-primary">3</span>
                </div>
                <div>
                  <strong className="text-foreground">Deeper Integration</strong>
                  <p className="text-sm text-muted-foreground">
                    Leverage Claude-specific features we can't replicate elsewhere
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <span className="text-xs font-bold text-primary">4</span>
                </div>
                <div>
                  <strong className="text-foreground">Honest Compatibility</strong>
                  <p className="text-sm text-muted-foreground">
                    We only support what we can properly test and validate
                  </p>
                </div>
              </li>
            </ul>
            <p className="mt-4 text-sm italic text-muted-foreground">
              This isn't a limitation - it's a superpower. By focusing on one platform, we can build
              features that would be impossible with multi-platform support.
            </p>
          </div>

          {/* Migration Path */}
          <h3 className="mb-6 text-2xl font-bold">Migration Path</h3>

          {/* Option 1: Using Claude */}
          <div className="mb-8 rounded-2xl border-2 border-cat-green/30 bg-cat-green/10 p-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="mt-1 h-6 w-6 flex-shrink-0 text-cat-green" />
              <div>
                <h4 className="mb-2 text-xl font-bold">
                  If You're Using Claude Code or Claude Desktop
                </h4>
                <p className="mb-4 text-muted-foreground">
                  <strong className="text-foreground">You're all set!</strong> Just update to
                  v0.5.0:
                </p>
                <div className="mb-4 rounded-lg bg-black p-4 font-mono text-sm">
                  <div>
                    <span className="text-cat-teal">$</span> npm update -g prjct-cli
                  </div>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  Your existing <code className="text-cat-mauve">.prjct/</code> data is fully
                  compatible. Nothing changes for you except <strong>better features</strong>:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    • 🤖 Dynamic AI agents (PM, Frontend, Backend, UX, QA, Scribe, Security, DevOps,
                    Mobile, Data)
                  </li>
                  <li>• 🔗 Native MCP integration (Context7, Sequential, Magic, Playwright)</li>
                  <li>• ✅ Git validation (last commit as source of truth)</li>
                  <li>• 💬 Natural language commands (talk naturally, no memorization)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Option 2: Not Using Claude */}
          <div className="mb-8 rounded-2xl border-2 border-cat-yellow/30 bg-cat-yellow/10 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 h-6 w-6 flex-shrink-0 text-cat-yellow" />
              <div>
                <h4 className="mb-2 text-xl font-bold">
                  If You're Using Cursor, Windsurf, or OpenAI Codex
                </h4>
                <p className="mb-4 text-muted-foreground">You have two options:</p>

                <div className="space-y-4">
                  <div className="rounded-lg bg-background/50 p-4">
                    <h5 className="mb-2 font-bold">Option 1: Switch to Claude (Recommended)</h5>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Claude Code is <strong>free</strong> and works exactly like Cursor:
                    </p>
                    <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
                      <li>
                        Install Claude Code from{' '}
                        <a
                          href="https://claude.ai/code"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          https://claude.ai/code
                        </a>
                      </li>
                      <li>
                        Update prjct-cli:{' '}
                        <code className="text-cat-mauve">npm update -g prjct-cli</code>
                      </li>
                      <li>
                        Install commands: <code className="text-cat-mauve">prjct install</code>
                      </li>
                      <li>
                        Done! All your <code className="text-cat-mauve">.prjct/</code> data works
                        exactly the same
                      </li>
                    </ol>
                  </div>

                  <div className="rounded-lg bg-background/50 p-4">
                    <h5 className="mb-2 font-bold">Option 2: Stay on v0.4.10 (Not Recommended)</h5>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Lock to the last multi-editor version:
                    </p>
                    <div className="mb-3 rounded-lg bg-black p-4 font-mono text-sm">
                      <div>
                        <span className="text-cat-teal">$</span> npm install -g prjct-cli@0.4.10
                      </div>
                    </div>
                    <p className="mb-2 text-sm text-muted-foreground">
                      <strong>⚠️ Downsides:</strong>
                    </p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• ❌ No new features</li>
                      <li>• ❌ No bug fixes</li>
                      <li>• ❌ No security updates</li>
                      <li>• ❌ Missing: AI agents, MCP, git validation, natural language</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* What's New */}
          <div className="mb-8 rounded-2xl bg-muted/20 p-6">
            <h3 className="mb-4 text-2xl font-bold">What's New in v0.5.0?</h3>
            <p className="mb-6 text-muted-foreground">
              This isn't just removing support - it's a <strong>massive upgrade</strong> for Claude
              users:
            </p>

            <div className="space-y-4">
              <div>
                <h4 className="mb-2 flex items-center gap-2 font-bold">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Dynamic AI Agents
                </h4>
                <p className="mb-2 text-sm text-muted-foreground">
                  Auto-generated specialists for your stack. Activated automatically based on
                  context.
                </p>
              </div>

              <div>
                <h4 className="mb-2 flex items-center gap-2 font-bold">
                  <Shield className="h-5 w-5 text-primary" />
                  MCP Integration
                </h4>
                <p className="mb-2 text-sm text-muted-foreground">
                  Native Model Context Protocol support (always enabled): Context7, Sequential,
                  Magic, Playwright
                </p>
              </div>

              <div>
                <h4 className="mb-2 flex items-center gap-2 font-bold">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Git Validation
                </h4>
                <p className="mb-2 text-sm text-muted-foreground">
                  Last commit as source of truth - validates completion against actual git changes
                </p>
              </div>
            </div>
          </div>

          <Link
            to="/changelog"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            View Full v0.5.0 Changelog
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.section>

        {/* v0.2.1 Migration */}
        <motion.section
          id="v021"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <h2 className="mb-6 text-4xl font-bold">v0.1.0 → v0.2.1 (Data Architecture Change)</h2>

          {/* Zero Data Loss Alert */}
          <div className="mb-8 rounded-2xl border-2 border-cat-green/30 bg-cat-green/10 p-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="mt-1 h-6 w-6 flex-shrink-0 text-cat-green" />
              <div>
                <h3 className="mb-2 text-xl font-bold text-cat-green">Zero Data Loss Guarantee</h3>
                <p className="mb-4 text-muted-foreground">
                  <strong className="text-foreground">This is a RELOCATION, not a deletion:</strong>
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-cat-green" />
                    <span>
                      <strong>ALL your data is preserved</strong> - Every file, every log entry,
                      every timestamp
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-cat-green" />
                    <span>
                      <strong>Complete history maintained</strong> - Nothing is lost or modified
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-cat-green" />
                    <span>
                      <strong>Reversible process</strong> - Can rollback if needed (.prjct/ kept by
                      default)
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* What Changed */}
          <div className="mb-8">
            <h3 className="mb-4 text-2xl font-bold">What Changed?</h3>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl bg-muted/20 p-6">
                <h4 className="mb-3 font-bold">Before (v0.1.0)</h4>
                <div className="rounded-lg bg-black p-4 font-mono text-xs">
                  <div>your-project/</div>
                  <div>├── .prjct/</div>
                  <div>│ ├── now.md</div>
                  <div>│ ├── next.md</div>
                  <div>│ ├── shipped.md</div>
                  <div>│ ├── ideas.md</div>
                  <div>│ └── memory.jsonl</div>
                  <div>├── src/</div>
                  <div>└── package.json</div>
                </div>
              </div>

              <div className="rounded-2xl bg-muted/20 p-6">
                <h4 className="mb-3 font-bold">After (v0.2.1)</h4>
                <div className="rounded-lg bg-black p-4 font-mono text-xs">
                  <div>your-project/</div>
                  <div>├── .prjct/</div>
                  <div>│ └── prjct.config.json</div>
                  <div>├── src/</div>
                  <div>└── package.json</div>
                  <div className="mt-3">~/.prjct-cli/</div>
                  <div>└── projects/abc123/</div>
                  <div> ├── core/</div>
                  <div> ├── progress/</div>
                  <div> ├── planning/</div>
                  <div> └── memory/</div>
                </div>
              </div>
            </div>
          </div>

          {/* Why This Change */}
          <div className="mb-8 rounded-2xl bg-muted/20 p-6">
            <h3 className="mb-4 text-2xl font-bold">Why This Change?</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Database className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                <div>
                  <strong className="text-foreground">No Bundle Size Inflation</strong>
                  <p className="text-sm text-muted-foreground">
                    Your project data no longer bloats your repository
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                <div>
                  <strong className="text-foreground">Privacy & Security</strong>
                  <p className="text-sm text-muted-foreground">
                    Work logs and personal notes stay on YOUR machine
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                <div>
                  <strong className="text-foreground">Collaboration-Ready</strong>
                  <p className="text-sm text-muted-foreground">
                    Teams can collaborate without exposing personal data
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Migration Methods */}
          <div className="mb-8">
            <h3 className="mb-4 text-2xl font-bold">Migration Methods</h3>
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-background/50 p-4">
                <h4 className="mb-2 font-bold">Method 1: Automatic Migration (Recommended)</h4>
                <div className="mb-3 rounded-lg bg-black p-4 font-mono text-sm">
                  <div>
                    <span className="text-cat-teal">$</span> npm update -g prjct-cli
                  </div>
                  <div className="text-muted-foreground"># CLI will detect and offer migration</div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background/50 p-4">
                <h4 className="mb-2 font-bold">Method 2: Manual Migration via Command</h4>
                <div className="mb-3 rounded-lg bg-black p-4 font-mono text-sm">
                  <div>
                    <span className="text-cat-teal">$</span> /p:migrate
                  </div>
                  <div>
                    <span className="text-cat-teal">$</span> /p:migrate --dry-run
                  </div>
                  <div>
                    <span className="text-cat-teal">$</span> /p:migrate --remove-legacy
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background/50 p-4">
                <h4 className="mb-2 font-bold">Method 3: Fresh Initialization</h4>
                <div className="mb-3 rounded-lg bg-black p-4 font-mono text-sm">
                  <div>
                    <span className="text-cat-teal">$</span> rm -rf .prjct
                  </div>
                  <div>
                    <span className="text-cat-teal">$</span> /p:init
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  ⚠️ This loses existing data. Only use for fresh starts.
                </p>
              </div>
            </div>
          </div>

          {/* Post-Migration */}
          <div className="mb-8 rounded-2xl bg-muted/20 p-6">
            <h3 className="mb-4 text-2xl font-bold">Post-Migration Verification</h3>
            <p className="mb-4 text-muted-foreground">After migration, verify your data:</p>
            <div className="space-y-1 rounded-lg bg-black p-4 font-mono text-sm">
              <div>
                <span className="text-cat-teal">$</span> /p:recap{' '}
                <span className="text-muted-foreground"># Should show your shipped features</span>
              </div>
              <div>
                <span className="text-cat-teal">$</span> /p:next{' '}
                <span className="text-muted-foreground"># Should show queued tasks</span>
              </div>
              <div>
                <span className="text-cat-teal">$</span> /p:context{' '}
                <span className="text-muted-foreground"># Check author information</span>
              </div>
            </div>
          </div>

          <Link
            to="/changelog"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            View Full v0.2.0 Changelog
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.section>

        {/* Getting Help */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="rounded-2xl border border-primary/20 bg-primary/10 p-6"
        >
          <h3 className="mb-4 text-2xl font-bold">Getting Help</h3>
          <p className="mb-4 text-muted-foreground">If you encounter issues during migration:</p>
          <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
            <li>• Check this guide first</li>
            <li>
              • Review the{' '}
              <Link to="/changelog" className="text-primary hover:underline">
                Changelog
              </Link>{' '}
              for detailed changes
            </li>
            <li>
              • Run <code className="text-cat-mauve">/p:status</code> to diagnose issues
            </li>
            <li>
              • Open an issue on{' '}
              <a
                href="https://github.com/jlopezlira/prjct-cli/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub
              </a>
            </li>
          </ul>
          <div className="flex flex-wrap gap-4">
            <a
              href="https://github.com/jlopezlira/prjct-cli/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Report an Issue
            </a>
            <Link
              to="/docs"
              className="rounded-lg bg-muted/50 px-6 py-3 font-medium transition-colors hover:bg-muted"
            >
              Back to Documentation
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  )
}
