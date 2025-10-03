import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle, ArrowRight, Users, Database, Shield, Sparkles, GitBranch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BackToDocsButton } from '../../components/BackToDocsButton'

export const Migration = () => {
  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <BackToDocsButton />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6">
            <GitBranch className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Migration Guide</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Migration Guide
          </h1>
          <p className="text-xl text-muted-foreground">
            Jump to your migration path:
          </p>
          <div className="flex flex-col gap-2 mt-4">
            <a href="#v050" className="text-primary hover:underline font-medium">
              → v0.4.x → v0.5.0 (Upgrading to Build for Claude) 🆕
            </a>
            <a href="#v021" className="text-primary hover:underline font-medium">
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
          <h2 className="text-4xl font-bold mb-6">Upgrading to Build for Claude (v0.5.0)</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Ship fast, no BS - prjct-cli is now 100% Claude-focused.
          </p>

          {/* Breaking Change Alert */}
          <div className="mb-8 p-6 bg-cat-red/10 border-2 border-cat-red/30 rounded-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-cat-red flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-bold text-cat-red mb-2">Breaking Change</h3>
                <p className="text-muted-foreground">
                  Starting with v0.5.0, prjct-cli <strong>only supports Claude Code and Claude Desktop</strong>.
                  Support for Cursor, Windsurf, and OpenAI Codex has been removed.
                </p>
              </div>
            </div>
          </div>

          {/* Why Claude-Only */}
          <div className="mb-8 p-6 bg-muted/20 rounded-2xl">
            <h3 className="text-2xl font-bold mb-4">Why Claude-Only?</h3>
            <p className="text-muted-foreground mb-4">We chose to focus 100% on Claude because:</p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary text-xs font-bold">1</span>
                </div>
                <div>
                  <strong className="text-foreground">Better Quality</strong>
                  <p className="text-sm text-muted-foreground">Optimize for Claude's unique capabilities (MCP, agents, natural language)</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary text-xs font-bold">2</span>
                </div>
                <div>
                  <strong className="text-foreground">Faster Development</strong>
                  <p className="text-sm text-muted-foreground">50-60% less code = faster features and bug fixes</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary text-xs font-bold">3</span>
                </div>
                <div>
                  <strong className="text-foreground">Deeper Integration</strong>
                  <p className="text-sm text-muted-foreground">Leverage Claude-specific features we can't replicate elsewhere</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary text-xs font-bold">4</span>
                </div>
                <div>
                  <strong className="text-foreground">Honest Compatibility</strong>
                  <p className="text-sm text-muted-foreground">We only support what we can properly test and validate</p>
                </div>
              </li>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground italic">
              This isn't a limitation - it's a superpower. By focusing on one platform, we can build features that would be impossible with multi-platform support.
            </p>
          </div>

          {/* Migration Path */}
          <h3 className="text-2xl font-bold mb-6">Migration Path</h3>

          {/* Option 1: Using Claude */}
          <div className="mb-8 p-6 bg-cat-green/10 border-2 border-cat-green/30 rounded-2xl">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-cat-green flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-xl font-bold mb-2">If You're Using Claude Code or Claude Desktop</h4>
                <p className="text-muted-foreground mb-4">
                  <strong className="text-foreground">You're all set!</strong> Just update to v0.5.0:
                </p>
                <div className="bg-black rounded-lg p-4 font-mono text-sm mb-4">
                  <div><span className="text-cat-teal">$</span> npm update -g prjct-cli</div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Your existing <code className="text-cat-mauve">.prjct/</code> data is fully compatible. Nothing changes for you except <strong>better features</strong>:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 🤖 Dynamic AI agents (PM, Frontend, Backend, UX, QA, Scribe, Security, DevOps, Mobile, Data)</li>
                  <li>• 🔗 Native MCP integration (Context7, Sequential, Magic, Playwright)</li>
                  <li>• ✅ Git validation (last commit as source of truth)</li>
                  <li>• 💬 Natural language commands (talk naturally, no memorization)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Option 2: Not Using Claude */}
          <div className="mb-8 p-6 bg-cat-yellow/10 border-2 border-cat-yellow/30 rounded-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-cat-yellow flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-xl font-bold mb-2">If You're Using Cursor, Windsurf, or OpenAI Codex</h4>
                <p className="text-muted-foreground mb-4">You have two options:</p>

                <div className="space-y-4">
                  <div className="p-4 bg-background/50 rounded-lg">
                    <h5 className="font-bold mb-2">Option 1: Switch to Claude (Recommended)</h5>
                    <p className="text-sm text-muted-foreground mb-3">
                      Claude Code is <strong>free</strong> and works exactly like Cursor:
                    </p>
                    <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                      <li>Install Claude Code from <a href="https://claude.ai/code" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://claude.ai/code</a></li>
                      <li>Update prjct-cli: <code className="text-cat-mauve">npm update -g prjct-cli</code></li>
                      <li>Install commands: <code className="text-cat-mauve">prjct install</code></li>
                      <li>Done! All your <code className="text-cat-mauve">.prjct/</code> data works exactly the same</li>
                    </ol>
                  </div>

                  <div className="p-4 bg-background/50 rounded-lg">
                    <h5 className="font-bold mb-2">Option 2: Stay on v0.4.10 (Not Recommended)</h5>
                    <p className="text-sm text-muted-foreground mb-3">
                      Lock to the last multi-editor version:
                    </p>
                    <div className="bg-black rounded-lg p-4 font-mono text-sm mb-3">
                      <div><span className="text-cat-teal">$</span> npm install -g prjct-cli@0.4.10</div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2"><strong>⚠️ Downsides:</strong></p>
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
          <div className="mb-8 p-6 bg-muted/20 rounded-2xl">
            <h3 className="text-2xl font-bold mb-4">What's New in v0.5.0?</h3>
            <p className="text-muted-foreground mb-6">
              This isn't just removing support - it's a <strong>massive upgrade</strong> for Claude users:
            </p>

            <div className="space-y-4">
              <div>
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Dynamic AI Agents
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Auto-generated specialists for your stack. Activated automatically based on context.
                </p>
              </div>

              <div>
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  MCP Integration
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Native Model Context Protocol support (always enabled): Context7, Sequential, Magic, Playwright
                </p>
              </div>

              <div>
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  Git Validation
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Last commit as source of truth - validates completion against actual git changes
                </p>
              </div>
            </div>
          </div>

          <Link
            to="/changelog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            View Full v0.5.0 Changelog
            <ArrowRight className="w-4 h-4" />
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
          <h2 className="text-4xl font-bold mb-6">v0.1.0 → v0.2.1 (Data Architecture Change)</h2>

          {/* Zero Data Loss Alert */}
          <div className="mb-8 p-6 bg-cat-green/10 border-2 border-cat-green/30 rounded-2xl">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-cat-green flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-bold text-cat-green mb-2">Zero Data Loss Guarantee</h3>
                <p className="text-muted-foreground mb-4">
                  <strong className="text-foreground">This is a RELOCATION, not a deletion:</strong>
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-cat-green" />
                    <span><strong>ALL your data is preserved</strong> - Every file, every log entry, every timestamp</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-cat-green" />
                    <span><strong>Complete history maintained</strong> - Nothing is lost or modified</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-cat-green" />
                    <span><strong>Reversible process</strong> - Can rollback if needed (.prjct/ kept by default)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* What Changed */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold mb-4">What Changed?</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 bg-muted/20 rounded-2xl">
                <h4 className="font-bold mb-3">Before (v0.1.0)</h4>
                <div className="bg-black rounded-lg p-4 font-mono text-xs">
                  <div>your-project/</div>
                  <div>├── .prjct/</div>
                  <div>│   ├── now.md</div>
                  <div>│   ├── next.md</div>
                  <div>│   ├── shipped.md</div>
                  <div>│   ├── ideas.md</div>
                  <div>│   └── memory.jsonl</div>
                  <div>├── src/</div>
                  <div>└── package.json</div>
                </div>
              </div>

              <div className="p-6 bg-muted/20 rounded-2xl">
                <h4 className="font-bold mb-3">After (v0.2.1)</h4>
                <div className="bg-black rounded-lg p-4 font-mono text-xs">
                  <div>your-project/</div>
                  <div>├── .prjct/</div>
                  <div>│   └── prjct.config.json</div>
                  <div>├── src/</div>
                  <div>└── package.json</div>
                  <div className="mt-3">~/.prjct-cli/</div>
                  <div>└── projects/abc123/</div>
                  <div>    ├── core/</div>
                  <div>    ├── progress/</div>
                  <div>    ├── planning/</div>
                  <div>    └── memory/</div>
                </div>
              </div>
            </div>
          </div>

          {/* Why This Change */}
          <div className="mb-8 p-6 bg-muted/20 rounded-2xl">
            <h3 className="text-2xl font-bold mb-4">Why This Change?</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Database className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                <div>
                  <strong className="text-foreground">No Bundle Size Inflation</strong>
                  <p className="text-sm text-muted-foreground">Your project data no longer bloats your repository</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                <div>
                  <strong className="text-foreground">Privacy & Security</strong>
                  <p className="text-sm text-muted-foreground">Work logs and personal notes stay on YOUR machine</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                <div>
                  <strong className="text-foreground">Collaboration-Ready</strong>
                  <p className="text-sm text-muted-foreground">Teams can collaborate without exposing personal data</p>
                </div>
              </div>
            </div>
          </div>

          {/* Migration Methods */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold mb-4">Migration Methods</h3>
            <div className="space-y-4">
              <div className="p-4 bg-background/50 rounded-lg border border-border">
                <h4 className="font-bold mb-2">Method 1: Automatic Migration (Recommended)</h4>
                <div className="bg-black rounded-lg p-4 font-mono text-sm mb-3">
                  <div><span className="text-cat-teal">$</span> npm update -g prjct-cli</div>
                  <div className="text-muted-foreground"># CLI will detect and offer migration</div>
                </div>
              </div>

              <div className="p-4 bg-background/50 rounded-lg border border-border">
                <h4 className="font-bold mb-2">Method 2: Manual Migration via Command</h4>
                <div className="bg-black rounded-lg p-4 font-mono text-sm mb-3">
                  <div><span className="text-cat-teal">$</span> /p:migrate</div>
                  <div><span className="text-cat-teal">$</span> /p:migrate --dry-run</div>
                  <div><span className="text-cat-teal">$</span> /p:migrate --remove-legacy</div>
                </div>
              </div>

              <div className="p-4 bg-background/50 rounded-lg border border-border">
                <h4 className="font-bold mb-2">Method 3: Fresh Initialization</h4>
                <div className="bg-black rounded-lg p-4 font-mono text-sm mb-3">
                  <div><span className="text-cat-teal">$</span> rm -rf .prjct</div>
                  <div><span className="text-cat-teal">$</span> /p:init</div>
                </div>
                <p className="text-sm text-muted-foreground">⚠️ This loses existing data. Only use for fresh starts.</p>
              </div>
            </div>
          </div>

          {/* Post-Migration */}
          <div className="mb-8 p-6 bg-muted/20 rounded-2xl">
            <h3 className="text-2xl font-bold mb-4">Post-Migration Verification</h3>
            <p className="text-muted-foreground mb-4">After migration, verify your data:</p>
            <div className="bg-black rounded-lg p-4 font-mono text-sm space-y-1">
              <div><span className="text-cat-teal">$</span> /p:recap <span className="text-muted-foreground"># Should show your shipped features</span></div>
              <div><span className="text-cat-teal">$</span> /p:next <span className="text-muted-foreground"># Should show queued tasks</span></div>
              <div><span className="text-cat-teal">$</span> /p:context <span className="text-muted-foreground"># Check author information</span></div>
            </div>
          </div>

          <Link
            to="/changelog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            View Full v0.2.0 Changelog
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.section>

        {/* Getting Help */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="p-6 bg-primary/10 rounded-2xl border border-primary/20"
        >
          <h3 className="text-2xl font-bold mb-4">Getting Help</h3>
          <p className="text-muted-foreground mb-4">
            If you encounter issues during migration:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground mb-6">
            <li>• Check this guide first</li>
            <li>• Review the <Link to="/changelog" className="text-primary hover:underline">Changelog</Link> for detailed changes</li>
            <li>• Run <code className="text-cat-mauve">/p:status</code> to diagnose issues</li>
            <li>• Open an issue on <a href="https://github.com/jlopezlira/prjct-cli/issues" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GitHub</a></li>
          </ul>
          <div className="flex flex-wrap gap-4">
            <a
              href="https://github.com/jlopezlira/prjct-cli/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Report an Issue
            </a>
            <Link
              to="/docs"
              className="px-6 py-3 bg-muted/50 rounded-lg font-medium hover:bg-muted transition-colors"
            >
              Back to Documentation
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  )
}
