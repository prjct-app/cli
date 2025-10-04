import { motion } from 'framer-motion'
import { GitBranch, GitCommit, Sparkles, CheckCircle, Rocket, Zap } from 'lucide-react'
import { BackToDocsButton } from '../../components/BackToDocsButton'

export const GitIntegration = () => {
  const features = [
    {
      icon: <Rocket className="h-5 w-5" />,
      title: 'Automated Shipping Workflow',
      description:
        '/p:ship automates the complete workflow: lint → test → docs → version → changelog → commit → push',
    },
    {
      icon: <CheckCircle className="h-5 w-5" />,
      title: 'Last Commit Validation',
      description:
        'Tasks are validated against actual code changes - no empty claims or false progress',
    },
    {
      icon: <GitCommit className="h-5 w-5" />,
      title: 'Smart Commit Messages',
      description:
        'Auto-generated commits with metadata: agent, time, complexity, and conventional format',
    },
    {
      icon: <GitBranch className="h-5 w-5" />,
      title: 'Branch Awareness',
      description: 'Works with your current branch automatically - no need to specify or switch',
    },
  ]

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
            <span className="text-sm font-medium text-primary">Version Control</span>
          </div>
          <h1 className="mb-6 text-5xl font-bold md:text-6xl">Git Integration</h1>
          <p className="text-xl text-muted-foreground">
            Automated Git workflow that validates real progress and ships features with intelligent
            commits - all built into /p:ship.
          </p>
        </motion.div>

        {/* Features */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-16"
        >
          <h2 className="mb-8 text-3xl font-bold">Features</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="rounded-2xl bg-muted/20 p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">{feature.icon}</div>
                  <div>
                    <h3 className="mb-2 font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* The /p:ship Command */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <h2 className="mb-8 text-3xl font-bold">The /p:ship Command</h2>
          <div className="rounded-2xl border border-border p-6 transition-colors hover:border-primary/50">
            <div className="mb-4">
              <code className="font-mono text-lg text-primary">/p:ship "feature name"</code>
              <p className="mt-2 text-muted-foreground">
                Complete automated workflow for shipping features
              </p>
            </div>

            <div className="mb-4 rounded-lg bg-muted/30 p-4">
              <p className="mb-3 text-sm font-semibold">Automated Steps:</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-cat-green" />
                  <span>1. Run lint checks (non-blocking)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-cat-green" />
                  <span>2. Execute tests (non-blocking)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-cat-green" />
                  <span>3. Update documentation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-cat-green" />
                  <span>4. Bump version (patch/minor)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-cat-green" />
                  <span>5. Update CHANGELOG.md</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-cat-green" />
                  <span>6. Create Git commit with metadata</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-cat-green" />
                  <span>7. Push to remote automatically</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>8. Recommend conversation compact</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-black p-4 font-mono text-sm">
              <span className="text-cat-teal">$</span> /p:ship "authentication system"
              <div className="mt-2 text-gray-400">
                <div>🚀 Shipping: authentication system</div>
                <div className="mt-1"> ✅ Lint: passed</div>
                <div> ✅ Tests: 24 passing</div>
                <div> ✅ Docs: updated</div>
                <div> ✅ Version: 1.2.0 → 1.3.0</div>
                <div> ✅ CHANGELOG: updated</div>
                <div> ✅ Git: committed + pushed</div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">💡 Non-blocking tests:</strong> If tests or lint
              fail, /p:ship shows the errors but doesn't block. You decide if it's acceptable to
              ship. This prevents infinite "fix → test → fail" loops.
            </p>
          </div>
        </motion.section>

        {/* Commit Message Format */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-16"
        >
          <h2 className="mb-8 text-3xl font-bold">Smart Commit Messages</h2>
          <p className="mb-6 text-muted-foreground">
            prjct automatically generates structured commits with full metadata:
          </p>

          <div className="mb-6 rounded-lg bg-black p-4 font-mono text-sm">
            <div className="text-cat-green">feat: add user authentication system</div>
            <div className="mt-2 text-gray-400">
              <div>Agent: Backend</div>
              <div>Dev: @yourusername</div>
              <div>Complexity: medium</div>
              <div>Time: 4h 30m</div>
              <div className="mt-2">
                🤖 Generated with <span className="text-primary">[p/](https://www.prjct.app/)</span>
              </div>
              <div>
                Designed for{' '}
                <span className="text-primary">[Claude](https://www.anthropic.com/claude)</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="mb-3 font-semibold">Conventional Commit Types:</h3>
            <div className="flex items-center gap-4 rounded-lg bg-muted/20 p-4">
              <code className="text-cat-green">feat:</code>
              <span>New feature or enhancement</span>
            </div>
            <div className="flex items-center gap-4 rounded-lg bg-muted/20 p-4">
              <code className="text-cat-sapphire">fix:</code>
              <span>Bug fix or correction</span>
            </div>
            <div className="flex items-center gap-4 rounded-lg bg-muted/20 p-4">
              <code className="text-cat-yellow">refactor:</code>
              <span>Code restructuring without behavior change</span>
            </div>
            <div className="flex items-center gap-4 rounded-lg bg-muted/20 p-4">
              <code className="text-cat-peach">docs:</code>
              <span>Documentation updates</span>
            </div>
            <div className="flex items-center gap-4 rounded-lg bg-muted/20 p-4">
              <code className="text-cat-teal">test:</code>
              <span>Test additions or updates</span>
            </div>
          </div>
        </motion.section>

        {/* Workflow Examples */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-16"
        >
          <h2 className="mb-8 text-3xl font-bold">Real Workflows</h2>

          {/* Solo Developer Flow */}
          <div className="mb-8 rounded-2xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
            <h3 className="mb-4 text-xl font-semibold">Solo Developer Flow</h3>
            <div className="space-y-3">
              <div className="rounded-lg bg-black/50 p-4 font-mono text-sm">
                <div className="text-gray-300"># Add a new feature</div>
                <div>
                  <span className="text-cat-teal">$</span> /p:feature "payment processing"
                </div>
                <div className="text-gray-400">→ ✨ Value analysis + 5 tasks created</div>
              </div>
              <div className="rounded-lg bg-black/50 p-4 font-mono text-sm">
                <div className="text-gray-300"># Complete tasks as you work</div>
                <div>
                  <span className="text-cat-teal">$</span> /p:done
                </div>
                <div className="text-gray-400">→ ✅ Task 1 complete, auto-starting task 2</div>
              </div>
              <div className="rounded-lg bg-black/50 p-4 font-mono text-sm">
                <div className="text-gray-300"># Ship when ready - automates everything</div>
                <div>
                  <span className="text-cat-teal">$</span> /p:ship "payment processing"
                </div>
                <div className="text-gray-400">→ 🚀 Complete workflow + auto-pushed to remote</div>
              </div>
            </div>
          </div>

          {/* Team Collaboration Flow */}
          <div className="rounded-2xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 p-6">
            <h3 className="mb-4 text-xl font-semibold">Team Collaboration Flow</h3>
            <div className="space-y-3">
              <div className="rounded-lg bg-black/50 p-4 font-mono text-sm">
                <div className="text-gray-300"># Sync with team manually</div>
                <div>
                  <span className="text-cat-teal">$</span> git pull
                </div>
                <div className="text-gray-400">→ 🔄 Get latest changes</div>
              </div>
              <div className="rounded-lg bg-black/50 p-4 font-mono text-sm">
                <div className="text-gray-300"># Add your feature</div>
                <div>
                  <span className="text-cat-teal">$</span> /p:feature "API endpoint"
                </div>
                <div className="text-gray-400">→ ✨ Feature created with tasks</div>
              </div>
              <div className="rounded-lg bg-black/50 p-4 font-mono text-sm">
                <div className="text-gray-300"># Complete and ship - auto-pushes</div>
                <div>
                  <span className="text-cat-teal">$</span> /p:done
                </div>
                <div>
                  <span className="text-cat-teal">$</span> /p:ship "API endpoint"
                </div>
                <div className="text-gray-400">→ 🚀 Workflow complete + pushed to remote</div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Git Validation */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-16"
        >
          <h2 className="mb-8 text-3xl font-bold">Git Validation</h2>
          <div className="rounded-2xl bg-muted/20 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3 text-primary">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">Last Commit as Source of Truth</h3>
                <p className="mb-4 text-muted-foreground">
                  prjct validates your progress against actual Git commits - no fake progress or
                  empty claims.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-cat-green" />
                    <span>Tasks are linked to real code changes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-cat-green" />
                    <span>Automatic diff analysis validates completion</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-cat-green" />
                    <span>Branch-aware context for accurate tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-cat-green" />
                    <span>Commit messages integrated into progress reports</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Configuration */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="rounded-2xl bg-muted/20 p-6"
        >
          <h2 className="mb-4 text-2xl font-bold">Configuration</h2>
          <p className="mb-4 text-muted-foreground">
            prjct works seamlessly with your existing Git setup. Zero additional configuration
            required.
          </p>
          <div className="space-y-2 text-sm">
            <p>✓ Uses your configured git user and email</p>
            <p>✓ Works with any remote (GitHub, GitLab, Bitbucket)</p>
            <p>✓ Respects your .gitignore patterns</p>
            <p>✓ Compatible with git hooks and CI/CD pipelines</p>
            <p>✓ Automatic push after successful /p:ship</p>
          </div>
        </motion.section>
      </div>
    </div>
  )
}
