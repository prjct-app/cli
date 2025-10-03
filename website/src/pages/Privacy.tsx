import { motion } from 'framer-motion'
import { Shield, Lock, Eye, Server, Users, Database, Globe, Key } from 'lucide-react'

export const Privacy = () => {
  const noCollectItems = [
    'No personal information',
    'No project data',
    'No usage analytics',
    'No telemetry',
    'No cookies',
    'No tracking',
    'No cloud storage',
    'No remote servers',
  ]

  return (
    <div className="min-h-screen px-4 py-20">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-cat-green/10 px-4 py-2">
            <Shield className="h-4 w-4 text-cat-green" />
            <span className="text-sm font-medium text-cat-green">100% Private</span>
          </div>
          <h1 className="mb-6 text-5xl font-bold md:text-6xl">Privacy Policy</h1>
          <p className="text-xl text-muted-foreground">Last updated: January 2025</p>
        </motion.div>

        {/* Overview Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-12 rounded-2xl bg-gradient-to-br from-cat-green/20 to-cat-green/5 p-8"
        >
          <h2 className="mb-4 text-3xl font-bold">Overview</h2>
          <p className="text-xl">
            prjct is a <span className="font-bold text-cat-green">100% local, privacy-first</span>{' '}
            developer momentum tool. We take your privacy seriously - in fact, we don't collect ANY
            of your data.
          </p>
        </motion.div>

        {/* What We DON'T Collect */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12"
        >
          <h2 className="mb-6 flex items-center gap-2 text-3xl font-bold">
            <Eye className="h-8 w-8" />
            What We DON'T Collect
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {noCollectItems.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                className="flex items-center gap-3 rounded-lg bg-cat-red/10 p-3"
              >
                <span className="text-cat-red">❌</span>
                <span className="font-medium">{item}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* How prjct Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="space-y-8"
        >
          <h2 className="text-3xl font-bold">How prjct Works</h2>

          <section className="rounded-lg bg-muted/20 p-6">
            <h3 className="mb-3 flex items-center gap-2 text-xl font-bold">
              <Database className="h-6 w-6 text-cat-blue" />
              Local Storage Only
            </h3>
            <p className="text-muted-foreground">
              All your data is stored locally on your machine in a <code>.prjct</code> folder within
              your project directory. This data never leaves your computer unless you explicitly
              choose to version control it with git or share it through your own means.
            </p>
          </section>

          <section className="rounded-lg bg-muted/20 p-6">
            <h3 className="mb-3 flex items-center gap-2 text-xl font-bold">
              <Server className="h-6 w-6 text-cat-yellow" />
              No Network Requests
            </h3>
            <p className="mb-3 text-muted-foreground">
              prjct itself makes <strong>ZERO</strong> network requests. The only network activity
              comes from:
            </p>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              <li>
                Your AI assistant (Claude Code, Cursor, etc.) - governed by their respective privacy
                policies
              </li>
              <li>
                Git operations if you choose to version control your <code>.prjct</code> folder
              </li>
            </ul>
          </section>

          <section className="rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 p-6">
            <h3 className="mb-3 flex items-center gap-2 text-xl font-bold">
              <Key className="h-6 w-6 text-primary" />
              Your Data is YOURS
            </h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>✓ You have complete control over your data</li>
              <li>✓ You can delete it anytime by removing the `.prjct` folder</li>
              <li>✓ You can backup, move, or share it as you see fit</li>
              <li>✓ You can inspect everything - it's just text files</li>
            </ul>
          </section>
        </motion.div>

        {/* AI Assistant Integration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12"
        >
          <h2 className="mb-6 text-3xl font-bold">AI Assistant Integration</h2>
          <div className="rounded-lg bg-muted/20 p-6">
            <p className="mb-4 text-muted-foreground">
              While prjct doesn't collect data, it works within AI assistants like:
            </p>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg bg-background p-3 text-center">Claude Code</div>
              <div className="rounded-lg bg-background p-3 text-center">Cursor</div>
              <div className="rounded-lg bg-background p-3 text-center">OpenAI Codex</div>
              <div className="rounded-lg bg-background p-3 text-center">Warp Code</div>
            </div>
            <p className="text-sm text-muted-foreground">
              These AI services have their own privacy policies. When you use prjct commands, the AI
              assistant processes them according to their respective terms.
            </p>
          </div>
        </motion.div>

        {/* Open Source Transparency */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12"
        >
          <h2 className="mb-6 flex items-center gap-2 text-3xl font-bold">
            <Globe className="h-8 w-8" />
            Open Source Transparency
          </h2>
          <p className="mb-4 text-muted-foreground">prjct is fully open source. You can:</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              • Review all code on{' '}
              <a
                href="https://github.com/jlopezlira/prjct-cli"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                GitHub
              </a>
            </li>
            <li>• Verify there's no data collection</li>
            <li>• Fork and modify it for your needs</li>
            <li>• Contribute improvements</li>
          </ul>
        </motion.div>

        {/* Website Privacy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12"
        >
          <h2 className="mb-6 text-3xl font-bold">Website Privacy</h2>
          <div className="rounded-lg bg-muted/20 p-6">
            <p className="mb-3 text-muted-foreground">
              Our landing page (prjct.app) is a static site hosted on GitHub Pages:
            </p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• No cookies are set</li>
              <li>• No analytics are collected</li>
              <li>• No user data is stored</li>
              <li>
                • GitHub Pages may collect basic access logs per their{' '}
                <a
                  href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:no-underline"
                >
                  privacy policy
                </a>
              </li>
            </ul>
          </div>
        </motion.div>

        {/* Data Security */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-12"
        >
          <h2 className="mb-6 flex items-center gap-2 text-3xl font-bold">
            <Lock className="h-8 w-8" />
            Data Security
          </h2>
          <p className="mb-3 text-muted-foreground">Since all data is local:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• Security depends on your machine's security</li>
            <li>• Use disk encryption for sensitive projects</li>
            <li>• Follow your organization's security policies</li>
            <li>• Backup your data regularly</li>
          </ul>
        </motion.div>

        {/* Your Rights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-12"
        >
          <h2 className="mb-6 flex items-center gap-2 text-3xl font-bold">
            <Users className="h-8 w-8" />
            Your Rights
          </h2>
          <p className="mb-4 text-muted-foreground">
            With prjct, you have complete rights to your data:
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-primary/10 p-4">
              <strong>Access</strong>: Your data is in plain text files
            </div>
            <div className="rounded-lg bg-primary/10 p-4">
              <strong>Modify</strong>: Edit any file directly
            </div>
            <div className="rounded-lg bg-primary/10 p-4">
              <strong>Delete</strong>: Remove the <code>.prjct</code> folder
            </div>
            <div className="rounded-lg bg-primary/10 p-4">
              <strong>Portability</strong>: Copy your <code>.prjct</code> folder anywhere
            </div>
            <div className="rounded-lg bg-primary/10 p-4 md:col-span-2">
              <strong>Control</strong>: You decide what happens with your data
            </div>
          </div>
        </motion.div>

        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="mt-16 rounded-2xl bg-gradient-to-br from-cat-green/20 to-cat-green/5 p-8 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold">Summary</h2>
          <p className="text-xl font-semibold text-cat-green">
            TL;DR: We don't want your data. We don't collect your data. Everything stays on your
            computer. You're in complete control.
          </p>
        </motion.div>

        {/* Footer note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-8 text-center text-sm text-muted-foreground"
        >
          <p>
            This privacy policy is effective as of January 2025 and was created to be transparent
            about our commitment to your privacy, even though we literally don't collect anything.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
