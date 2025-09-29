import { motion } from 'framer-motion'
import {
  Target,
  Map,
  Brain,
  Sparkles,
  Plus,
  Settings,
  Zap,
  MessageSquare,
  Command,
  FileText,
  Rocket,
  Edit3,
  Calendar,
  ListChecks,
  Bot,
} from 'lucide-react'

const WindsurfPreview = () => {
  const roadmapItems = [
    {
      title: 'Authentication System',
      status: 'in-progress',
      complexity: '3 days',
      ai_confidence: 92,
    },
    { title: 'Payment Integration', status: 'queued', complexity: '5 days', ai_confidence: 87 },
    { title: 'Dashboard Analytics', status: 'idea', complexity: '2 days', ai_confidence: 95 },
    { title: 'Email Notifications', status: 'queued', complexity: '1 day', ai_confidence: 98 },
  ]

  const projectRules = [
    { rule: 'Ship daily, no exceptions', active: true, impact: 'high' },
    { rule: 'Test coverage > 80%', active: true, impact: 'medium' },
    { rule: 'No deploy on Fridays', active: false, impact: 'low' },
  ]

  const aiSuggestions = [
    { action: 'Break down Payment Integration', reason: 'Too complex for single task' },
    { action: 'Prioritize Email Notifications', reason: 'Quick win, high user impact' },
    { action: 'Add API rate limiting', reason: 'Security best practice' },
  ]

  return (
    <div className="relative">
      {/* Floating Features - Moved to top */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-6 flex justify-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-cat-mauve/30 bg-gradient-to-r from-purple-500/20 to-blue-500/20 px-6 py-3 backdrop-blur-sm">
          <Zap className="h-4 w-4 text-cat-mauve" />
          <span className="text-sm font-medium">
            Drag & Drop Roadmap • AI Task Generation • Custom Rules
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        className="relative mx-auto max-w-6xl"
      >
        <div className="flex gap-4">
          {/* Main Editor Area */}
          <div className="flex-1 overflow-hidden rounded-lg border border-border/30 bg-card/60">
            <div className="flex items-center justify-between border-b border-border/20 bg-card/40 px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">project.code</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded bg-cat-green/20 px-2 py-1 text-xs text-cat-green">
                  <Target className="h-3 w-3" />
                  Focused
                </div>
              </div>
            </div>

            {/* Visual Roadmap */}
            <div className="bg-background/30 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Map className="h-4 w-4 text-cat-mauve" />
                  Interactive Roadmap
                </h3>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-1 rounded-lg bg-cat-mauve/20 px-3 py-1 text-xs text-cat-mauve"
                >
                  <Brain className="h-3 w-3" />
                  AI Generate
                </motion.button>
              </div>

              {/* Kanban-style Roadmap */}
              <div className="grid grid-cols-3 gap-4">
                {/* In Progress */}
                <div className="space-y-2">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">NOW (1)</div>
                  {roadmapItems
                    .filter((i) => i.status === 'in-progress')
                    .map((item, idx) => (
                      <motion.div
                        key={idx}
                        className="cursor-move rounded-lg border border-cat-mauve/30 bg-cat-mauve/10 p-3"
                        whileHover={{ scale: 1.02, y: -2 }}
                        draggable
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <p className="text-xs font-medium">{item.title}</p>
                          <Edit3 className="h-3 w-3 cursor-pointer text-cat-mauve" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            {item.complexity}
                          </span>
                          <div className="flex items-center gap-1">
                            <Bot className="h-3 w-3 text-cat-green" />
                            <span className="text-[10px] text-cat-green">
                              {item.ai_confidence}%
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </div>

                {/* Queued */}
                <div className="space-y-2">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">NEXT (2)</div>
                  {roadmapItems
                    .filter((i) => i.status === 'queued')
                    .map((item, idx) => (
                      <motion.div
                        key={idx}
                        className="cursor-move rounded-lg border border-cat-sapphire/30 bg-cat-sapphire/10 p-3"
                        whileHover={{ scale: 1.02, y: -2 }}
                        draggable
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <p className="text-xs font-medium">{item.title}</p>
                          <Edit3 className="h-3 w-3 cursor-pointer text-cat-sapphire" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            {item.complexity}
                          </span>
                          <div className="flex items-center gap-1">
                            <Bot className="h-3 w-3 text-cat-green" />
                            <span className="text-[10px] text-cat-green">
                              {item.ai_confidence}%
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </div>

                {/* Ideas */}
                <div className="space-y-2">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">IDEAS (1)</div>
                  {roadmapItems
                    .filter((i) => i.status === 'idea')
                    .map((item, idx) => (
                      <motion.div
                        key={idx}
                        className="cursor-move rounded-lg border border-gray-500/30 bg-gray-500/10 p-3"
                        whileHover={{ scale: 1.02, y: -2 }}
                        draggable
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <p className="text-xs font-medium">{item.title}</p>
                          <Edit3 className="h-3 w-3 cursor-pointer text-gray-500" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            {item.complexity}
                          </span>
                          <div className="flex items-center gap-1">
                            <Bot className="h-3 w-3 text-cat-green" />
                            <span className="text-[10px] text-cat-green">
                              {item.ai_confidence}%
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                  {/* Add New Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-500/30 p-3 text-xs text-muted-foreground hover:border-gray-500/50 hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    Add Idea
                  </motion.button>
                </div>
              </div>
            </div>
          </div>

          {/* PRJCT Control Panel */}
          <motion.div
            className="w-96 overflow-hidden rounded-lg border border-cat-mauve/20 bg-gradient-to-br from-purple-500/10 via-card/80 to-blue-500/10 backdrop-blur-md"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            {/* Panel Header */}
            <div className="border-b border-cat-mauve/30 bg-gradient-to-r from-purple-600/20 to-blue-600/20 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Command className="h-4 w-4 text-cat-mauve" />
                  <span className="text-sm font-semibold">PRJCT Control Center</span>
                </div>
                <Settings className="h-4 w-4 cursor-pointer text-muted-foreground" />
              </div>
            </div>

            {/* Project Rules - Editable */}
            <div className="border-b border-border/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-semibold">
                  <FileText className="h-3 w-3" />
                  Project Rules
                </h3>
                <button className="text-xs text-cat-mauve">+ Add</button>
              </div>
              <div className="space-y-2">
                {projectRules.map((rule, idx) => (
                  <motion.div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-background/30 p-2"
                    whileHover={{ x: 2 }}
                  >
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        className={`h-4 w-4 rounded-full border-2 ${
                          rule.active ? 'border-cat-mauve bg-cat-mauve' : 'border-muted-foreground'
                        }`}
                        onClick={() => {}}
                      />
                      <span
                        className={`text-xs ${!rule.active && 'text-muted-foreground line-through'}`}
                      >
                        {rule.rule}
                      </span>
                    </div>
                    <Edit3 className="h-3 w-3 cursor-pointer text-muted-foreground" />
                  </motion.div>
                ))}
              </div>
            </div>

            {/* AI Task Generator */}
            <div className="border-b border-border/30 p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-xs font-semibold">
                    <Brain className="h-3 w-3" />
                    AI Task Breakdown
                  </h3>
                  <Sparkles className="h-3 w-3 animate-pulse text-cat-yellow" />
                </div>

                {/* AI Input */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Describe what you want to build..."
                    className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-xs focus:border-cat-mauve/50 focus:outline-none"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    className="absolute right-1 top-1 rounded bg-cat-mauve/20 px-2 py-1 text-xs text-cat-mauve"
                  >
                    Generate
                  </motion.button>
                </div>

                {/* AI Suggestions */}
                <div className="space-y-2">
                  {aiSuggestions.map((suggestion, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="rounded-lg bg-gradient-to-r from-purple-500/5 to-blue-500/5 p-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="flex items-center gap-1 text-xs font-medium">
                            <Sparkles className="h-3 w-3 text-cat-yellow" />
                            {suggestion.action}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {suggestion.reason}
                          </p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          className="rounded bg-cat-mauve/20 px-2 py-1 text-[10px] text-cat-mauve"
                        >
                          Apply
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Commands */}
            <div className="p-4">
              <h3 className="mb-3 text-xs font-semibold">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 py-2 text-xs font-medium hover:from-purple-500/30 hover:to-blue-500/30"
                >
                  <Rocket className="h-3 w-3" />
                  Ship Now
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center justify-center gap-1 rounded-lg bg-background/50 py-2 text-xs hover:bg-background/70"
                >
                  <Calendar className="h-3 w-3" />
                  Week View
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center justify-center gap-1 rounded-lg bg-background/50 py-2 text-xs hover:bg-background/70"
                >
                  <ListChecks className="h-3 w-3" />
                  Templates
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center justify-center gap-1 rounded-lg bg-background/50 py-2 text-xs hover:bg-background/70"
                >
                  <MessageSquare className="h-3 w-3" />
                  AI Chat
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export default WindsurfPreview
