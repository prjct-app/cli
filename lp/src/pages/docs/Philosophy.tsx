import { motion } from 'framer-motion'
import { Brain, Target, Zap, Trophy, Clock, Users, XCircle } from 'lucide-react'
import { BackToDocsButton } from '../../components/BackToDocsButton'

export const Philosophy = () => {
 const principles = [
  {
   icon: <Target className="w-6 h-6" />,
   title: "Single Focus",
   description: "One task at a time. No context switching, no multitasking chaos.",
   why: "Deep work produces better results than scattered attention."
  },
  {
   icon: <Zap className="w-6 h-6" />,
   title: "Zero Friction",
   description: "Commands integrate into your existing workflow, not replace it.",
   why: "The best tools are the ones you actually use."
  },
  {
   icon: <Trophy className="w-6 h-6" />,
   title: "Celebration Built-in",
   description: "Every /p:ship is a moment to celebrate your progress.",
   why: "Acknowledging wins maintains momentum and motivation."
  },
  {
   icon: <XCircle className="w-6 h-6" />,
   title: "No Ceremonies",
   description: "No sprints, story points, or planning meetings.",
   why: "Ship features, not attend meetings."
  }
 ]

 const antiPatterns = [
  { bad: "Story Points", good: "Features Shipped" },
  { bad: "Hours Logged", good: "Outcomes Achieved" },
  { bad: "Burndown Charts", good: "Celebration Messages" },
  { bad: "Sprint Planning", good: "Just Start Working" },
  { bad: "Retrospectives", good: "Ship and Learn" },
  { bad: "Velocity Metrics", good: "Actual Progress" }
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
      <Brain className="w-4 h-4 text-primary" />
      <span className="text-sm font-medium text-primary">The prjct Mindset</span>
     </div>
     <h1 className="text-5xl md:text-6xl font-bold mb-6">
      Philosophy
     </h1>
     <p className="text-xl text-muted-foreground">
      prjct is built on simple principles that prioritize shipping over ceremony,
      focus over multitasking, and celebration over metrics.
     </p>
    </motion.div>

    {/* Core Principles */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.1 }}
     className="mb-16"
    >
     <h2 className="text-3xl font-bold mb-8">Core Principles</h2>
     <div className="space-y-6">
      {principles.map((principle, index) => (
       <motion.div
        key={principle.title}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        className="flex gap-4 p-6 bg-muted/20 rounded-2xl hover:bg-muted/30 transition-colors"
       >
        <div className="p-3 rounded-lg bg-primary/10 text-primary h-fit">
         {principle.icon}
        </div>
        <div className="flex-1">
         <h3 className="text-xl font-semibold mb-2">{principle.title}</h3>
         <p className="text-muted-foreground mb-3">{principle.description}</p>
         <p className="text-sm font-medium text-primary/80">
          Why: {principle.why}
         </p>
        </div>
       </motion.div>
      ))}
     </div>
    </motion.section>

    {/* The Problem We Solve */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.2 }}
     className="mb-16 p-8 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-2xl"
    >
     <h2 className="text-3xl font-bold mb-6">The Problem We Solve</h2>
     <div className="space-y-4 text-lg">
      <p>
       Traditional project management tools were built for managers, not makers.
       They optimize for visibility, reporting, and process compliance.
      </p>
      <p>
       <strong>But indie hackers don't need that.</strong>
      </p>
      <p>
       You need to ship fast, stay focused, and maintain momentum. You need a system
       that works with your flow, not against it. That's why we built prjct.
      </p>
     </div>
    </motion.section>

    {/* What We Track vs What We Don't */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.3 }}
     className="mb-16"
    >
     <h2 className="text-3xl font-bold mb-8">We Track What Matters</h2>
     <div className="grid md:grid-cols-2 gap-8">
      {/* What We Track */}
      <div className="space-y-4">
       <h3 className="text-xl font-semibold text-cat-green">✅ What We Track</h3>
       <ul className="space-y-3">
        <li className="flex items-center gap-2">
         <CheckCircle className="w-5 h-5 text-cat-green" />
         <span>Features shipped</span>
        </li>
        <li className="flex items-center gap-2">
         <CheckCircle className="w-5 h-5 text-cat-green" />
         <span>Current focus</span>
        </li>
        <li className="flex items-center gap-2">
         <CheckCircle className="w-5 h-5 text-cat-green" />
         <span>Ideas captured</span>
        </li>
        <li className="flex items-center gap-2">
         <CheckCircle className="w-5 h-5 text-cat-green" />
         <span>Progress milestones</span>
        </li>
        <li className="flex items-center gap-2">
         <CheckCircle className="w-5 h-5 text-cat-green" />
         <span>Wins to celebrate</span>
        </li>
       </ul>
      </div>

      {/* What We Don't Track */}
      <div className="space-y-4">
       <h3 className="text-xl font-semibold text-cat-red">❌ What We Don't</h3>
       <div className="space-y-3">
        {antiPatterns.map(pattern => (
         <div key={pattern.bad} className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-cat-red" />
          <span className="line-through text-muted-foreground">{pattern.bad}</span>
         </div>
        ))}
       </div>
      </div>
     </div>
    </motion.section>

    {/* The prjct Way */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.4 }}
     className="mb-16"
    >
     <h2 className="text-3xl font-bold mb-8">The prjct Way</h2>
     <div className="space-y-6">
      <div className="p-6 bg-muted/20 rounded-2xl">
       <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        Daily Workflow
       </h3>
       <ol className="space-y-2 text-muted-foreground">
        <li>1. Start with <code className="text-primary">/p:recap</code> to see where you are</li>
        <li>2. Set focus with <code className="text-primary">/p:now</code></li>
        <li>3. Work deeply on one task</li>
        <li>4. Complete with <code className="text-primary">/p:done</code></li>
        <li>5. Ship and celebrate with <code className="text-primary">/p:ship</code></li>
       </ol>
      </div>

      <div className="p-6 bg-muted/20 rounded-2xl">
       <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        Who It's For
       </h3>
       <ul className="space-y-2 text-muted-foreground">
        <li>• Indie hackers shipping products solo</li>
        <li>• Developers on side projects</li>
        <li>• Solopreneurs building their dreams</li>
        <li>• Anyone who values shipping over meetings</li>
       </ul>
      </div>
     </div>
    </motion.section>

    {/* Manifesto */}
    <motion.section
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6, delay: 0.5 }}
     className="text-center p-8 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl"
    >
     <h2 className="text-3xl font-bold mb-6">Our Manifesto</h2>
     <blockquote className="text-xl italic space-y-2">
      <p>"We believe in shipping, not planning to ship."</p>
      <p>"We believe in focus, not fractured attention."</p>
      <p>"We believe in progress, not process."</p>
      <p>"We believe in celebration, not metrics."</p>
     </blockquote>
     <p className="mt-6 text-lg font-semibold text-primary">
      Built for builders who ship, not managers who meet.
     </p>
    </motion.section>
   </div>
  </div>
 )
}

// Add missing import
import { CheckCircle } from 'lucide-react'