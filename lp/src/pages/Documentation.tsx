import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Book, GitBranch, Zap, Shield, Cloud, Code2 } from 'lucide-react'

const docSections = [
 {
  icon: <Zap className="w-6 h-6" />,
  title: 'Quick Start',
  description: 'Get up and running in under 2 minutes',
  link: '/docs/quick-start',
  internal: true,
 },
 {
  icon: <Code2 className="w-6 h-6" />,
  title: 'Command Reference',
  description: 'Complete list of all prjct commands',
  link: '/commands',
  internal: true,
 },
 {
  icon: <Book className="w-6 h-6" />,
  title: 'Philosophy',
  description: 'Understand the prjct mindset',
  link: '/docs/philosophy',
  internal: true,
 },
 {
  icon: <GitBranch className="w-6 h-6" />,
  title: 'Git Integration',
  description: 'Smart commits and version control',
  link: '/docs/git-integration',
  internal: true,
 },
 {
  icon: <Shield className="w-6 h-6" />,
  title: 'Best Practices',
  description: 'Tips for maximum productivity',
  link: '/docs/best-practices',
  internal: true,
 },
 {
  icon: <Cloud className="w-6 h-6" />,
  title: 'MCP Integration',
  description: 'AI assistant configuration',
  link: '/docs/mcp-integration',
  internal: true,
 },
]

export const Documentation = () => {
 return (
  <div className="min-h-screen py-20 px-4">
   <div className="max-w-7xl mx-auto">
    {/* Header */}
    <motion.div
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6 }}
     className="text-center mb-16"
    >
     <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
      Documentation
     </h1>
     <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
      Everything you need to master prjct and ship features faster than ever
     </p>
    </motion.div>

    {/* Documentation Grid */}
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
     {docSections.map((section, index) => (
      <motion.div
       key={section.title}
       initial={{ opacity: 0, y: 20 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ duration: 0.5, delay: index * 0.1 }}
      >
       <Link
        to={section.link}
        className="block group border border-border rounded-2xl p-6 hover:shadow-lg transition-all hover:border-primary/50 hover:bg-primary/5"
      >
       <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
         {section.icon}
        </div>
        <div>
         <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
          {section.title}
         </h3>
         <p className="text-sm text-muted-foreground">
          {section.description}
         </p>
        </div>
       </div>
       </Link>
      </motion.div>
     ))}
    </div>

    {/* Getting Started Section */}
    <motion.div
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.3 }}
     className="mt-20 p-8 bg-muted/20 rounded-2xl"
    >
     <h2 className="text-3xl font-bold mb-6">Getting Started</h2>
     <div className="space-y-6">
      <div>
       <h3 className="text-xl font-semibold mb-3">1. Install prjct</h3>
       <div className="bg-black rounded-lg p-4 font-mono text-sm">
        <span className="text-cat-teal">$</span> curl -fsSL https://www.prjct.app/install.sh | bash
       </div>
      </div>
      <div>
       <h3 className="text-xl font-semibold mb-3">2. Initialize your project</h3>
       <div className="bg-black rounded-lg p-4 font-mono text-sm">
        <span className="text-cat-teal">$</span> /p:init
       </div>
      </div>
      <div>
       <h3 className="text-xl font-semibold mb-3">3. Start shipping</h3>
       <div className="bg-black rounded-lg p-4 font-mono text-sm">
        <span className="text-cat-teal">$</span> /p:now "build awesome feature"
       </div>
      </div>
     </div>
    </motion.div>

    {/* Resources */}
    <motion.div
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.4 }}
     className="mt-12 text-center"
    >
     <h2 className="text-2xl font-bold mb-6">Additional Resources</h2>
     <div className="flex flex-wrap gap-4 justify-center">
      <a
       href="https://github.com/jlopezlira/prjct-cli"
       className="px-6 py-3 border border-border rounded-lg hover:bg-muted transition-all"
       target="_blank"
       rel="noopener noreferrer"
      >
       GitHub Repository →
      </a>
      <a
       href="https://github.com/jlopezlira/prjct-cli/issues"
       className="px-6 py-3 border border-border rounded-lg hover:bg-muted transition-all"
       target="_blank"
       rel="noopener noreferrer"
      >
       Report Issues →
      </a>
      <a
       href="https://github.com/jlopezlira/prjct-cli/blob/main/CONTRIBUTING.md"
       className="px-6 py-3 border border-border rounded-lg hover:bg-muted transition-all"
       target="_blank"
       rel="noopener noreferrer"
      >
       Contributing Guide →
      </a>
     </div>
    </motion.div>
   </div>
  </div>
 )
}