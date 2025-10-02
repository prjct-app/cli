import { motion } from 'framer-motion'
import { Zap, CheckCircle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BackToDocsButton } from '../../components/BackToDocsButton'

export const QuickStart = () => {
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
      <Zap className="w-4 h-4 text-primary" />
      <span className="text-sm font-medium text-primary">2 Minute Setup</span>
     </div>
     <h1 className="text-5xl md:text-6xl font-bold mb-6">
      Quick Start
     </h1>
     <p className="text-xl text-muted-foreground">
      Get prjct running in your project in under 2 minutes. No complex configuration, no learning curve.
     </p>
    </motion.div>

    {/* Prerequisites */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.1 }}
     className="mb-12 p-6 bg-muted/20 rounded-2xl"
    >
     <h2 className="text-2xl font-bold mb-4">Prerequisites</h2>
     <ul className="space-y-2">
      <li className="flex items-center gap-2">
       <CheckCircle className="w-5 h-5 text-cat-green" />
       <span>Node.js 18+ installed</span>
      </li>
      <li className="flex items-center gap-2">
       <CheckCircle className="w-5 h-5 text-cat-green" />
       <span>AI Assistant (Claude Code, Cursor, or similar)</span>
      </li>
      <li className="flex items-center gap-2">
       <CheckCircle className="w-5 h-5 text-cat-green" />
       <span>Git initialized in your project</span>
      </li>
     </ul>
    </motion.section>

    {/* Installation Steps */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.2 }}
     className="space-y-8 mb-12"
    >
     <h2 className="text-3xl font-bold">Installation</h2>

     {/* Step 1 */}
     <div className="space-y-4">
      <div className="flex items-center gap-3">
       <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
        1
       </div>
       <h3 className="text-xl font-semibold">Install prjct</h3>
      </div>
      <div className="bg-black rounded-lg p-4 font-mono text-sm">
       <div><span className="text-cat-teal">$</span> npm install -g prjct-cli</div>
      </div>
      <p className="text-muted-foreground">
       This installs prjct globally on your system and makes it available for all your projects. Requires Node.js 18+.
      </p>
     </div>

     {/* Step 2 */}
     <div className="space-y-4">
      <div className="flex items-center gap-3">
       <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
        2
       </div>
       <h3 className="text-xl font-semibold">Initialize Your Project</h3>
      </div>
      <div className="bg-black rounded-lg p-4 font-mono text-sm">
       <div><span className="text-cat-teal">$</span> /p:init</div>
      </div>
      <p className="text-muted-foreground">
       This creates the `.prjct/` directory structure in your project with all necessary files.
      </p>
      <div className="p-4 bg-muted/30 rounded-lg">
       <p className="text-sm font-semibold mb-2">What gets created:</p>
       <ul className="text-sm text-muted-foreground space-y-1">
        <li>• <code>core/</code> - Current task and priorities</li>
        <li>• <code>progress/</code> - Metrics and achievements</li>
        <li>• <code>planning/</code> - Ideas and roadmap</li>
        <li>• <code>analysis/</code> - Technical insights</li>
        <li>• <code>memory/</code> - History and decisions</li>
       </ul>
      </div>
     </div>

     {/* Step 3 */}
     <div className="space-y-4">
      <div className="flex items-center gap-3">
       <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
        3
       </div>
       <h3 className="text-xl font-semibold">Start Your First Task</h3>
      </div>
      <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/30 mb-3">
       <p className="text-sm font-semibold mb-2 flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        💬 Talk Naturally (Recommended)
       </p>
       <div className="bg-black rounded-lg p-3 font-mono text-sm mb-2">
        <div className="text-gray-400">Just talk to your AI assistant:</div>
        <div className="text-cat-peach mt-1">"I want to start building user authentication"</div>
       </div>
       <p className="text-xs text-muted-foreground">
        The system detects your intent and maps it to the right command automatically.
       </p>
      </div>
      <div className="bg-black rounded-lg p-4 font-mono text-sm">
       <div className="text-gray-400 mb-1">Or use commands directly:</div>
       <div><span className="text-cat-teal">$</span> /p:now "implement user authentication"</div>
       <div className="text-gray-400 mt-2">→ 🎯 Current task set: implement user authentication</div>
      </div>
      <p className="text-muted-foreground">
       You're now tracking your work! Say "p. I'm done" when finished, or "p. ship this feature" to celebrate.
      </p>
     </div>
    </motion.section>

    {/* Your First Workflow */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.3 }}
     className="mb-12 p-6 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl"
    >
     <h2 className="text-2xl font-bold mb-4">Your First Workflow</h2>
     <div className="space-y-3">
      <div className="bg-black/50 rounded-lg p-4 font-mono text-sm">
       <div className="text-gray-300"># Start your day</div>
       <div><span className="text-cat-teal">$</span> /p:recap</div>
       <div className="text-gray-400">→ See where you left off</div>
      </div>
      <div className="bg-black/50 rounded-lg p-4 font-mono text-sm">
       <div className="text-gray-300"># Work on a task</div>
       <div><span className="text-cat-teal">$</span> /p:now "fix login bug"</div>
       <div className="text-gray-400">→ Focus on one thing</div>
      </div>
      <div className="bg-black/50 rounded-lg p-4 font-mono text-sm">
       <div className="text-gray-300"># Complete and ship</div>
       <div><span className="text-cat-teal">$</span> /p:done</div>
       <div><span className="text-cat-teal">$</span> /p:ship "authentication system"</div>
       <div className="text-gray-400">→ Celebrate your wins! 🎉</div>
      </div>
     </div>
    </motion.section>

    {/* Next Steps */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.4 }}
     className="text-center"
    >
     <h2 className="text-2xl font-bold mb-6">Next Steps</h2>
     <div className="flex flex-wrap gap-4 justify-center">
      <Link
       to="/commands"
       className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all"
      >
       Learn All Commands
       <ArrowRight className="w-4 h-4" />
      </Link>
      <Link
       to="/workflows-guide"
       className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-lg hover:bg-muted transition-all"
      >
       See Workflows
       <ArrowRight className="w-4 h-4" />
      </Link>
      <Link
       to="/docs/philosophy"
       className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-lg hover:bg-muted transition-all"
      >
       Understand Philosophy
       <ArrowRight className="w-4 h-4" />
      </Link>
     </div>
    </motion.section>
   </div>
  </div>
 )
}