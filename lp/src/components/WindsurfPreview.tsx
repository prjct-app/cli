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
 Bot
} from 'lucide-react'

const WindsurfPreview = () => {
 const roadmapItems = [
  { title: "Authentication System", status: "in-progress", complexity: "3 days", ai_confidence: 92 },
  { title: "Payment Integration", status: "queued", complexity: "5 days", ai_confidence: 87 },
  { title: "Dashboard Analytics", status: "idea", complexity: "2 days", ai_confidence: 95 },
  { title: "Email Notifications", status: "queued", complexity: "1 day", ai_confidence: 98 }
 ]

 const projectRules = [
  { rule: "Ship daily, no exceptions", active: true, impact: "high" },
  { rule: "Test coverage > 80%", active: true, impact: "medium" },
  { rule: "No deploy on Fridays", active: false, impact: "low" }
 ]

 const aiSuggestions = [
  { action: "Break down Payment Integration", reason: "Too complex for single task" },
  { action: "Prioritize Email Notifications", reason: "Quick win, high user impact" },
  { action: "Add API rate limiting", reason: "Security best practice" }
 ]

 return (
  <div className="relative">
   {/* Floating Features - Moved to top */}
   <motion.div
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.5 }}
    className="flex justify-center mb-6"
   >
    <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-cat-mauve/30 rounded-full backdrop-blur-sm">
     <Zap className="w-4 h-4 text-cat-mauve" />
     <span className="text-sm font-medium">Drag & Drop Roadmap • AI Task Generation • Custom Rules</span>
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
     <div className="flex-1 rounded-lg bg-card/60 border border-border/30 overflow-hidden">
      <div className="bg-card/40 border-b border-border/20 px-4 py-2 flex items-center justify-between">
       <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">project.code</span>
       </div>
       <div className="flex items-center gap-2">
        <div className="px-2 py-1 bg-cat-green/20 text-cat-green text-xs rounded flex items-center gap-1">
         <Target className="w-3 h-3" />
         Focused
        </div>
       </div>
      </div>

      {/* Visual Roadmap */}
      <div className="p-6 bg-background/30">
       <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
         <Map className="w-4 h-4 text-cat-mauve" />
         Interactive Roadmap
        </h3>
        <motion.button
         whileHover={{ scale: 1.05 }}
         className="px-3 py-1 bg-cat-mauve/20 text-cat-mauve text-xs rounded-lg flex items-center gap-1"
        >
         <Brain className="w-3 h-3" />
         AI Generate
        </motion.button>
       </div>

       {/* Kanban-style Roadmap */}
       <div className="grid grid-cols-3 gap-4">
        {/* In Progress */}
        <div className="space-y-2">
         <div className="text-xs font-medium text-muted-foreground mb-2">NOW (1)</div>
         {roadmapItems.filter(i => i.status === 'in-progress').map((item, idx) => (
          <motion.div
           key={idx}
           className="p-3 bg-cat-mauve/10 border border-cat-mauve/30 rounded-lg cursor-move"
           whileHover={{ scale: 1.02, y: -2 }}
           draggable
          >
           <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-medium">{item.title}</p>
            <Edit3 className="w-3 h-3 text-cat-mauve cursor-pointer" />
           </div>
           <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{item.complexity}</span>
            <div className="flex items-center gap-1">
             <Bot className="w-3 h-3 text-cat-green" />
             <span className="text-[10px] text-cat-green">{item.ai_confidence}%</span>
            </div>
           </div>
          </motion.div>
         ))}
        </div>

        {/* Queued */}
        <div className="space-y-2">
         <div className="text-xs font-medium text-muted-foreground mb-2">NEXT (2)</div>
         {roadmapItems.filter(i => i.status === 'queued').map((item, idx) => (
          <motion.div
           key={idx}
           className="p-3 bg-cat-sapphire/10 border border-cat-sapphire/30 rounded-lg cursor-move"
           whileHover={{ scale: 1.02, y: -2 }}
           draggable
          >
           <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-medium">{item.title}</p>
            <Edit3 className="w-3 h-3 text-cat-sapphire cursor-pointer" />
           </div>
           <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{item.complexity}</span>
            <div className="flex items-center gap-1">
             <Bot className="w-3 h-3 text-cat-green" />
             <span className="text-[10px] text-cat-green">{item.ai_confidence}%</span>
            </div>
           </div>
          </motion.div>
         ))}
        </div>

        {/* Ideas */}
        <div className="space-y-2">
         <div className="text-xs font-medium text-muted-foreground mb-2">IDEAS (1)</div>
         {roadmapItems.filter(i => i.status === 'idea').map((item, idx) => (
          <motion.div
           key={idx}
           className="p-3 bg-gray-500/10 border border-gray-500/30 rounded-lg cursor-move"
           whileHover={{ scale: 1.02, y: -2 }}
           draggable
          >
           <div className="flex items-start justify-between mb-2">
            <p className="text-xs font-medium">{item.title}</p>
            <Edit3 className="w-3 h-3 text-gray-500 cursor-pointer" />
           </div>
           <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{item.complexity}</span>
            <div className="flex items-center gap-1">
             <Bot className="w-3 h-3 text-cat-green" />
             <span className="text-[10px] text-cat-green">{item.ai_confidence}%</span>
            </div>
           </div>
          </motion.div>
         ))}

         {/* Add New Button */}
         <motion.button
          whileHover={{ scale: 1.02 }}
          className="w-full p-3 border border-dashed border-gray-500/30 rounded-lg flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:border-gray-500/50"
         >
          <Plus className="w-3 h-3" />
          Add Idea
         </motion.button>
        </div>
       </div>
      </div>
     </div>

     {/* PRJCT Control Panel */}
     <motion.div
      className="w-96 rounded-lg bg-gradient-to-br from-purple-500/10 via-card/80 to-blue-500/10 backdrop-blur-md border border-cat-mauve/20 overflow-hidden"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
     >
      {/* Panel Header */}
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-cat-mauve/30 px-4 py-3">
       <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
         <Command className="w-4 h-4 text-cat-mauve" />
         <span className="font-semibold text-sm">PRJCT Control Center</span>
        </div>
        <Settings className="w-4 h-4 text-muted-foreground cursor-pointer" />
       </div>
      </div>

      {/* Project Rules - Editable */}
      <div className="p-4 border-b border-border/30">
       <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold flex items-center gap-2">
         <FileText className="w-3 h-3" />
         Project Rules
        </h3>
        <button className="text-xs text-cat-mauve">+ Add</button>
       </div>
       <div className="space-y-2">
        {projectRules.map((rule, idx) => (
         <motion.div
          key={idx}
          className="flex items-center justify-between p-2 bg-background/30 rounded-lg"
          whileHover={{ x: 2 }}
         >
          <div className="flex items-center gap-2">
           <motion.button
            whileHover={{ scale: 1.1 }}
            className={`w-4 h-4 rounded-full border-2 ${
             rule.active
              ? 'bg-cat-mauve border-cat-mauve'
              : 'border-muted-foreground'
            }`}
            onClick={() => {}}
           />
           <span className={`text-xs ${!rule.active && 'text-muted-foreground line-through'}`}>
            {rule.rule}
           </span>
          </div>
          <Edit3 className="w-3 h-3 text-muted-foreground cursor-pointer" />
         </motion.div>
        ))}
       </div>
      </div>

      {/* AI Task Generator */}
      <div className="p-4 border-b border-border/30">
       <div className="space-y-3">
        <div className="flex items-center justify-between">
         <h3 className="text-xs font-semibold flex items-center gap-2">
          <Brain className="w-3 h-3" />
          AI Task Breakdown
         </h3>
         <Sparkles className="w-3 h-3 text-cat-yellow animate-pulse" />
        </div>

        {/* AI Input */}
        <div className="relative">
         <input
          type="text"
          placeholder="Describe what you want to build..."
          className="w-full px-3 py-2 bg-background/50 border border-border/50 rounded-lg text-xs focus:outline-none focus:border-cat-mauve/50"
         />
         <motion.button
          whileHover={{ scale: 1.05 }}
          className="absolute right-1 top-1 px-2 py-1 bg-cat-mauve/20 text-cat-mauve rounded text-xs"
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
           className="p-2 bg-gradient-to-r from-purple-500/5 to-blue-500/5 rounded-lg"
          >
           <div className="flex items-start justify-between">
            <div className="flex-1">
             <p className="text-xs font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cat-yellow" />
              {suggestion.action}
             </p>
             <p className="text-[10px] text-muted-foreground mt-1">{suggestion.reason}</p>
            </div>
            <motion.button
             whileHover={{ scale: 1.1 }}
             className="px-2 py-1 bg-cat-mauve/20 text-cat-mauve rounded text-[10px]"
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
       <h3 className="text-xs font-semibold mb-3">Quick Actions</h3>
       <div className="grid grid-cols-2 gap-2">
        <motion.button
         whileHover={{ scale: 1.02 }}
         className="py-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
        >
         <Rocket className="w-3 h-3" />
         Ship Now
        </motion.button>
        <motion.button
         whileHover={{ scale: 1.02 }}
         className="py-2 bg-background/50 hover:bg-background/70 rounded-lg text-xs flex items-center justify-center gap-1"
        >
         <Calendar className="w-3 h-3" />
         Week View
        </motion.button>
        <motion.button
         whileHover={{ scale: 1.02 }}
         className="py-2 bg-background/50 hover:bg-background/70 rounded-lg text-xs flex items-center justify-center gap-1"
        >
         <ListChecks className="w-3 h-3" />
         Templates
        </motion.button>
        <motion.button
         whileHover={{ scale: 1.02 }}
         className="py-2 bg-background/50 hover:bg-background/70 rounded-lg text-xs flex items-center justify-center gap-1"
        >
         <MessageSquare className="w-3 h-3" />
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