import { motion } from 'framer-motion'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    question: "What is prjct?",
    answer: "prjct is an AI-native project management framework that turns your ideas into executable technical roadmaps. It integrates directly into your AI coding assistant (Claude Code, Cursor, Warp) through simple slash commands. No project management overhead - just pure execution."
  },
  {
    question: "How does it work with AI assistants?",
    answer: "prjct commands run directly in your AI chat using /p: prefix. Your AI assistant understands your project context, tech stack, and progress. It can generate roadmaps, break down complex tasks, track progress, and help you ship features - all through natural conversation."
  },
  {
    question: "Which AI assistants are supported?",
    answer: "Currently supports Claude Code, Cursor, OpenAI Codex, Warp Code, and any AI assistant that supports custom commands or MCP (Model Context Protocol). The framework is extensible and can be adapted to new AI tools as they emerge."
  },
  {
    question: "Is this free? Do I need to pay anything?",
    answer: "Completely free and open source. No subscriptions, no cloud services, no hidden costs. You only pay for your AI assistant subscription (if applicable). All prjct features run locally on your machine."
  },
  {
    question: "Where is my data stored?",
    answer: "100% local. Everything stays in a .prjct folder in your project directory. No cloud tracking, no data mining, no telemetry. Your ideas, roadmaps, and progress are yours alone. You can version control it with git or keep it private."
  },
  {
    question: "Can I customize the commands?",
    answer: "Yes! The framework is fully extensible. Add custom commands, modify existing ones, or integrate with your tools. Each command is a simple markdown file that defines its behavior. Fork the repo and make it yours."
  },
  {
    question: "How do I get started?",
    answer: "One command: curl -sSL https://prjct.app/install.sh | bash. Then just type /p:init in your AI assistant to initialize your first project. The AI will guide you through everything else."
  },
  {
    question: "What makes this different from Jira or Linear?",
    answer: "prjct is AI-native from the ground up. No tickets, no sprints, no story points. Just you, your AI, and shipping code. It understands your codebase, suggests next tasks, and keeps you in flow. Built for indie hackers who ship fast, not enterprise ceremonies."
  }
]

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section id="faq" className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-muted-foreground">
            Everything you need to know about prjct
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              viewport={{ once: true }}
              className="border border-border rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-muted/30 transition-colors"
              >
                <span className="font-medium text-lg">{faq.question}</span>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                </motion.div>
              </button>

              <motion.div
                initial={false}
                animate={{
                  height: openIndex === index ? 'auto' : 0,
                  opacity: openIndex === index ? 1 : 0
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-4 text-muted-foreground">
                  {faq.answer}
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <p className="text-muted-foreground mb-4">
            Still have questions?
          </p>
          <a
            href="https://github.com/jlopezlira/prjct-cli/issues"
            className="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors"
          >
            <span>Ask on GitHub</span>
            <span>→</span>
          </a>
        </motion.div>
      </div>
    </section>
  )
}