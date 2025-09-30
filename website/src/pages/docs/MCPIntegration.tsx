import { motion } from 'framer-motion'
import { Bot, Code2, Settings, Sparkles, FileText, Database, Brain, CheckCircle } from 'lucide-react'
import { BackToDocsButton } from '../../components/BackToDocsButton'

export const MCPIntegration = () => {
 const assistants = [
  {
   name: "Claude Code",
   icon: <Brain className="w-6 h-6" />,
   description: "Anthropic's official AI coding assistant",
   configFile: "CLAUDE.md",
   features: [
    "Native /p: command support",
    "MCP server integration",
    "Context-aware suggestions",
    "Automatic file management"
   ]
  },
  {
   name: "Cursor",
   icon: <Code2 className="w-6 h-6" />,
   description: "AI-powered code editor",
   configFile: "AGENTS.md",
   features: [
    "Integrated terminal commands",
    "Smart code completion",
    "Project context awareness",
    "Multi-file operations"
   ]
  },
  {
   name: "OpenAI Codex",
   icon: <Bot className="w-6 h-6" />,
   description: "GitHub Copilot and ChatGPT",
   configFile: "AGENTS.md",
   features: [
    "Command execution via chat",
    "Code generation with context",
    "Natural language to commands",
    "Integrated workflow support"
   ]
  },
  {
   name: "Warp Terminal",
   icon: <Sparkles className="w-6 h-6" />,
   description: "AI-powered terminal",
   configFile: "Shell integration",
   features: [
    "Command suggestions",
    "Natural language queries",
    "Workflow automation",
    "Smart completions"
   ]
  }
 ]

 const mcpServers = [
  {
   name: "Filesystem MCP",
   icon: <FileText className="w-5 h-5" />,
   purpose: "Direct file manipulation",
   usage: "Read, write, and manage .prjct/ files"
  },
  {
   name: "Memory MCP",
   icon: <Database className="w-5 h-5" />,
   purpose: "Persistent decision storage",
   usage: "Track decisions, context, and history"
  },
  {
   name: "Context7 MCP",
   icon: <Brain className="w-5 h-5" />,
   purpose: "Library documentation",
   usage: "Access up-to-date framework docs"
  },
  {
   name: "Sequential MCP",
   icon: <Settings className="w-5 h-5" />,
   purpose: "Complex problem solving",
   usage: "Multi-step reasoning and analysis"
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
      <Bot className="w-4 h-4 text-primary" />
      <span className="text-sm font-medium text-primary">AI Assistant Setup</span>
     </div>
     <h1 className="text-5xl md:text-6xl font-bold mb-6">
      MCP Integration
     </h1>
     <p className="text-xl text-muted-foreground">
      Configure prjct to work seamlessly with your favorite AI assistant
      using the Model Context Protocol (MCP).
     </p>
    </motion.div>

    {/* What is MCP */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.1 }}
     className="mb-16 p-8 bg-muted/20 rounded-2xl"
    >
     <h2 className="text-2xl font-bold mb-4">What is MCP?</h2>
     <p className="text-muted-foreground mb-4">
      Model Context Protocol (MCP) is a standard that allows AI assistants to interact
      with external tools and services. prjct uses MCP to enable AI assistants to:
     </p>
     <ul className="space-y-2">
      <li className="flex items-center gap-2">
       <CheckCircle className="w-5 h-5 text-cat-green" />
       <span>Execute /p: commands directly</span>
      </li>
      <li className="flex items-center gap-2">
       <CheckCircle className="w-5 h-5 text-cat-green" />
       <span>Read and write project files</span>
      </li>
      <li className="flex items-center gap-2">
       <CheckCircle className="w-5 h-5 text-cat-green" />
       <span>Maintain context across sessions</span>
      </li>
      <li className="flex items-center gap-2">
       <CheckCircle className="w-5 h-5 text-cat-green" />
       <span>Access documentation and help</span>
      </li>
     </ul>
    </motion.section>

    {/* Supported Assistants */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.2 }}
     className="mb-16"
    >
     <h2 className="text-3xl font-bold mb-8">Supported AI Assistants</h2>
     <div className="grid md:grid-cols-2 gap-6">
      {assistants.map((assistant, index) => (
       <motion.div
        key={assistant.name}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        className="border border-border rounded-2xl p-6 hover:border-primary/50 transition-colors"
       >
        <div className="flex items-start gap-4 mb-4">
         <div className="p-3 rounded-lg bg-primary/10 text-primary">
          {assistant.icon}
         </div>
         <div>
          <h3 className="text-xl font-semibold">{assistant.name}</h3>
          <p className="text-sm text-muted-foreground">{assistant.description}</p>
         </div>
        </div>
        <div className="mb-4">
         <span className="text-sm font-medium text-primary">Config: </span>
         <code className="text-sm bg-muted px-2 py-1 rounded">{assistant.configFile}</code>
        </div>
        <ul className="space-y-1">
         {assistant.features.map((feature) => (
          <li key={feature} className="text-sm text-muted-foreground flex items-center gap-2">
           <span className="text-primary">•</span> {feature}
          </li>
         ))}
        </ul>
       </motion.div>
      ))}
     </div>
    </motion.section>

    {/* MCP Servers */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.3 }}
     className="mb-16"
    >
     <h2 className="text-3xl font-bold mb-8">MCP Servers</h2>
     <p className="text-muted-foreground mb-6">
      prjct integrates with multiple MCP servers to provide comprehensive functionality:
     </p>
     <div className="space-y-4">
      {mcpServers.map((server, index) => (
       <motion.div
        key={server.name}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: index * 0.05 }}
        className="flex gap-4 p-4 bg-muted/20 rounded-xl"
       >
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
         {server.icon}
        </div>
        <div className="flex-1">
         <h3 className="font-semibold">{server.name}</h3>
         <p className="text-sm text-muted-foreground">{server.purpose}</p>
         <p className="text-sm text-primary/80 mt-1">{server.usage}</p>
        </div>
       </motion.div>
      ))}
     </div>
    </motion.section>

    {/* Configuration Steps */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.4 }}
     className="mb-16"
    >
     <h2 className="text-3xl font-bold mb-8">Configuration</h2>

     {/* Claude Code Setup */}
     <div className="mb-8 p-6 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-2xl">
      <h3 className="text-xl font-semibold mb-4">Claude Code Setup</h3>
      <ol className="space-y-4">
       <li className="flex gap-3">
        <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
         1
        </span>
        <div>
         <p className="font-medium">CLAUDE.md is already included</p>
         <p className="text-sm text-muted-foreground">The configuration file is pre-installed in your project</p>
        </div>
       </li>
       <li className="flex gap-3">
        <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
         2
        </span>
        <div>
         <p className="font-medium">Commands work automatically</p>
         <p className="text-sm text-muted-foreground">Just type /p: commands in Claude Code</p>
        </div>
       </li>
      </ol>
     </div>

     {/* Other Assistants Setup */}
     <div className="p-6 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl">
      <h3 className="text-xl font-semibold mb-4">Other AI Assistants</h3>
      <ol className="space-y-4">
       <li className="flex gap-3">
        <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
         1
        </span>
        <div>
         <p className="font-medium">Copy AGENTS.md to your project</p>
         <p className="text-sm text-muted-foreground">Contains instructions for the AI assistant</p>
        </div>
       </li>
       <li className="flex gap-3">
        <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
         2
        </span>
        <div>
         <p className="font-medium">Reference in your AI tool</p>
         <p className="text-sm text-muted-foreground">Point your assistant to the AGENTS.md file</p>
        </div>
       </li>
       <li className="flex gap-3">
        <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
         3
        </span>
        <div>
         <p className="font-medium">Start using /p: commands</p>
         <p className="text-sm text-muted-foreground">Commands will be executed through the AI</p>
        </div>
       </li>
      </ol>
     </div>
    </motion.section>

    {/* Usage Examples */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.5 }}
     className="mb-16"
    >
     <h2 className="text-3xl font-bold mb-8">Usage Examples</h2>
     <div className="space-y-4">
      <div className="p-4 bg-black rounded-xl">
       <div className="text-gray-300 mb-2"># With Claude Code</div>
       <div className="font-mono text-sm">
        <div className="text-gray-400">You: "Initialize prjct in this project"</div>
        <div className="text-cat-teal mt-2">Claude: Running /p:init...</div>
        <div className="text-gray-400">→ ✅ Project initialized with layered structure</div>
       </div>
      </div>

      <div className="p-4 bg-black rounded-xl">
       <div className="text-gray-300 mb-2"># With ChatGPT</div>
       <div className="font-mono text-sm">
        <div className="text-gray-400">You: "Set my current task to implement auth"</div>
        <div className="text-cat-teal mt-2">GPT: I'll set that using prjct: /p:now "implement auth"</div>
        <div className="text-gray-400">→ 🎯 Current task set</div>
       </div>
      </div>

      <div className="p-4 bg-black rounded-xl">
       <div className="text-gray-300 mb-2"># With Cursor</div>
       <div className="font-mono text-sm">
        <div className="text-gray-400">You: "Complete task and commit"</div>
        <div className="text-cat-teal mt-2">Cursor: /p:done && /p:git</div>
        <div className="text-gray-400">→ ✅ Task completed</div>
        <div className="text-gray-400">→ 📝 Changes committed</div>
       </div>
      </div>
     </div>
    </motion.section>

    {/* Benefits */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.6 }}
     className="p-8 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl text-center"
    >
     <h2 className="text-2xl font-bold mb-4">Why Use MCP Integration?</h2>
     <div className="grid md:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
       <Sparkles className="w-5 h-5 text-primary" />
       <span>Natural language to commands</span>
      </div>
      <div className="flex items-center gap-2">
       <Sparkles className="w-5 h-5 text-primary" />
       <span>Automatic context awareness</span>
      </div>
      <div className="flex items-center gap-2">
       <Sparkles className="w-5 h-5 text-primary" />
       <span>Seamless workflow integration</span>
      </div>
      <div className="flex items-center gap-2">
       <Sparkles className="w-5 h-5 text-primary" />
       <span>No manual command memorization</span>
      </div>
     </div>
    </motion.section>
   </div>
  </div>
 )
}