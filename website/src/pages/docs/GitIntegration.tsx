import { motion } from 'framer-motion'
import { GitBranch, GitCommit, GitPullRequest, Sparkles, CheckCircle } from 'lucide-react'
import { BackToDocsButton } from '../../components/BackToDocsButton'

export const GitIntegration = () => {
 const commands = [
  {
   command: '/p:git',
   description: 'Smart git operations with context',
   example: '✅ feat: add user authentication system\n📝 3 files changed\n🌿 Ready for push',
   details: 'Analyzes your changes and creates meaningful commit messages following conventional commits. Provides context about changes and prepares code for manual push when ready.'
  }
 ]

 const features = [
  {
   icon: <Sparkles className="w-5 h-5" />,
   title: "Smart Commit Messages",
   description: "AI analyzes your changes and generates meaningful commit messages following best practices"
  },
  {
   icon: <GitCommit className="w-5 h-5" />,
   title: "Conventional Commits",
   description: "Automatically formats commits as feat:, fix:, docs:, style:, refactor:, test:, chore:"
  },
  {
   icon: <GitPullRequest className="w-5 h-5" />,
   title: "Branch Awareness",
   description: "Works with your current branch, no need to specify or switch"
  },
  {
   icon: <CheckCircle className="w-5 h-5" />,
   title: "Context-Aware Changes",
   description: "Provides detailed summary of changed files and prepares code for your git workflow"
  }
 ]

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
      <span className="text-sm font-medium text-primary">Version Control</span>
     </div>
     <h1 className="text-5xl md:text-6xl font-bold mb-6">
      Git Integration
     </h1>
     <p className="text-xl text-muted-foreground">
      Smart commits and version control that understands your code changes
      and generates meaningful messages automatically.
     </p>
    </motion.div>

    {/* Features */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.1 }}
     className="mb-16"
    >
     <h2 className="text-3xl font-bold mb-8">Features</h2>
     <div className="grid md:grid-cols-2 gap-6">
      {features.map((feature, index) => (
       <motion.div
        key={feature.title}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        className="p-6 bg-muted/20 rounded-2xl"
       >
        <div className="flex items-start gap-4">
         <div className="p-2 rounded-lg bg-primary/10 text-primary">
          {feature.icon}
         </div>
         <div>
          <h3 className="font-semibold mb-2">{feature.title}</h3>
          <p className="text-sm text-muted-foreground">{feature.description}</p>
         </div>
        </div>
       </motion.div>
      ))}
     </div>
    </motion.section>

    {/* Commands */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.2 }}
     className="mb-16"
    >
     <h2 className="text-3xl font-bold mb-8">Commands</h2>
     <div className="space-y-6">
      {commands.map((cmd, index) => (
       <motion.div
        key={cmd.command}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        className="border border-border rounded-2xl p-6 hover:border-primary/50 transition-colors"
       >
        <div className="mb-4">
         <code className="text-lg font-mono text-primary">{cmd.command}</code>
         <p className="text-muted-foreground mt-2">{cmd.description}</p>
        </div>
        <div className="bg-black rounded-lg p-4 font-mono text-sm mb-4">
         <span className="text-cat-teal">$</span> {cmd.command}
         <div className="text-gray-400 mt-2">→ {cmd.example}</div>
        </div>
        <p className="text-sm text-muted-foreground">{cmd.details}</p>
       </motion.div>
      ))}
     </div>
    </motion.section>

    {/* Workflow Examples */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.3 }}
     className="mb-16"
    >
     <h2 className="text-3xl font-bold mb-8">Common Workflows</h2>

     {/* Daily Commit Flow */}
     <div className="mb-8 p-6 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl">
      <h3 className="text-xl font-semibold mb-4">Daily Commit Flow</h3>
      <div className="space-y-3">
       <div className="bg-black/50 rounded-lg p-4 font-mono text-sm">
        <div className="text-gray-300"># After completing a feature</div>
        <div><span className="text-cat-teal">$</span> /p:done</div>
        <div className="text-gray-400">→ ✅ Task completed</div>
       </div>
       <div className="bg-black/50 rounded-lg p-4 font-mono text-sm">
        <div className="text-gray-300"># Commit with smart message and context</div>
        <div><span className="text-cat-teal">$</span> /p:git</div>
        <div className="text-gray-400">→ 📝 Analyzing changes...</div>
        <div className="text-gray-400">→ ✅ Committed: feat: add payment processing</div>
        <div className="text-gray-400">→ 📊 Files: 8 changed, +342 lines</div>
       </div>
       <div className="bg-black/50 rounded-lg p-4 font-mono text-sm">
        <div className="text-gray-300"># Push to remote manually when ready</div>
        <div><span className="text-cat-teal">$</span> git push</div>
        <div className="text-gray-400">→ Use standard git commands for push/pull</div>
       </div>
      </div>
     </div>

     {/* Collaborative Flow */}
     <div className="p-6 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-2xl">
      <h3 className="text-xl font-semibold mb-4">Team Collaboration Flow</h3>
      <div className="space-y-3">
       <div className="bg-black/50 rounded-lg p-4 font-mono text-sm">
        <div className="text-gray-300"># Start your day - sync with team using git</div>
        <div><span className="text-cat-teal">$</span> git pull</div>
        <div className="text-gray-400">→ 🔄 Get latest team changes</div>
       </div>
       <div className="bg-black/50 rounded-lg p-4 font-mono text-sm">
        <div className="text-gray-300"># Work on your tasks</div>
        <div><span className="text-cat-teal">$</span> /p:now "implement API endpoint"</div>
        <div className="text-gray-400">→ 🎯 Focus on your task</div>
       </div>
       <div className="bg-black/50 rounded-lg p-4 font-mono text-sm">
        <div className="text-gray-300"># Commit and share progress</div>
        <div><span className="text-cat-teal">$</span> /p:git</div>
        <div className="text-gray-400">→ ✅ Smart commit with context</div>
        <div><span className="text-cat-teal">$</span> git push</div>
        <div className="text-gray-400">→ 🚀 Share with team</div>
       </div>
      </div>
     </div>
    </motion.section>

    {/* Commit Message Examples */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.4 }}
     className="mb-16"
    >
     <h2 className="text-3xl font-bold mb-8">Smart Commit Examples</h2>
     <p className="text-muted-foreground mb-6">
      prjct analyzes your changes and generates conventional commit messages:
     </p>
     <div className="space-y-3">
      <div className="flex items-center gap-4 p-4 bg-muted/20 rounded-lg">
       <code className="text-cat-green">feat:</code>
       <span>add user authentication system with JWT tokens</span>
      </div>
      <div className="flex items-center gap-4 p-4 bg-muted/20 rounded-lg">
       <code className="text-cat-sapphire">fix:</code>
       <span>resolve memory leak in WebSocket connection handler</span>
      </div>
      <div className="flex items-center gap-4 p-4 bg-muted/20 rounded-lg">
       <code className="text-cat-yellow">refactor:</code>
       <span>simplify database connection logic</span>
      </div>
      <div className="flex items-center gap-4 p-4 bg-muted/20 rounded-lg">
       <code className="text-cat-mauve">style:</code>
       <span>update button styles for better accessibility</span>
      </div>
      <div className="flex items-center gap-4 p-4 bg-muted/20 rounded-lg">
       <code className="text-cat-peach">docs:</code>
       <span>update README with new installation instructions</span>
      </div>
      <div className="flex items-center gap-4 p-4 bg-muted/20 rounded-lg">
       <code className="text-cat-teal">test:</code>
       <span>add unit tests for payment processing module</span>
      </div>
     </div>
    </motion.section>

    {/* Configuration */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.5 }}
     className="p-6 bg-muted/20 rounded-2xl"
    >
     <h2 className="text-2xl font-bold mb-4">Configuration</h2>
     <p className="text-muted-foreground mb-4">
      prjct works with your existing git configuration. No additional setup required.
     </p>
     <div className="space-y-2 text-sm">
      <p>✓ Uses your configured git user and email</p>
      <p>✓ Works with any remote (GitHub, GitLab, Bitbucket)</p>
      <p>✓ Respects your .gitignore patterns</p>
      <p>✓ Compatible with git hooks and CI/CD</p>
     </div>
    </motion.section>
   </div>
  </div>
 )
}