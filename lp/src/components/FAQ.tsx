import { motion } from 'framer-motion'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Section } from './ui'

const faqs = [
  {
    question: "What happens if I use /p:now without finishing the previous task?",
    answer: "The previous task gets REPLACED automatically. prjct uses a 'single focus' philosophy - you can only have ONE active task at a time. If you need to switch context, use /p:done first to complete the current task, then /p:now with the new task."
  },
  {
    question: "What's the difference between /p:done and /p:ship?",
    answer: "/p:done = Complete current task and clear your focus. Used for any task.\n/p:ship = Celebrate an important FEATURE. Used when you complete something significant that deserves celebration. Example: /p:done for 'fix bug' vs /p:ship 'new payment system' 🎉"
  },
  {
    question: "Can I work on multiple tasks simultaneously?",
    answer: "NO by design. prjct enforces focus on a single task to maximize productivity. If you need to temporarily switch context, use /p:done to close the current one and /p:now for the new one. For complex tasks, use /p:task to break them down into manageable subtasks."
  },
  {
    question: "How do I modify or remove something from the roadmap?",
    answer: "Use: /p:roadmap to see everything, /p:roadmap add 'feature' to add new items, /p:roadmap complete 'item' to mark as done. To delete or modify, directly edit the .prjct/planning/roadmap.md file - it's simple markdown."
  },
  {
    question: "Can I undo a command?",
    answer: "There's no automatic 'undo', but you can: 1) Manually edit files in .prjct/ (they're simple markdown), 2) Use /p:now to change current task, 3) Files have history if you use git. Everything is transparent and editable."
  },
  {
    question: "What happens with my data? Where is it stored?",
    answer: "EVERYTHING is stored locally in .prjct/ within your project. No data leaves your machine. You can: version it with git, backup by copying the folder, manually edit it (it's markdown), or delete it whenever you want."
  },
  {
    question: "How do I migrate from Jira/Trello/Linear?",
    answer: "You don't need to migrate anything. Simply: /p:init to start fresh, /p:roadmap add to add your current features, /p:now for today's task. prjct doesn't import external data - you start clean and focused."
  },
  {
    question: "Does it work with teams or is it only for indies?",
    answer: "Designed for indie hackers and solopreneurs. For small teams: each dev can have their own local .prjct/, or share one via git. For large teams: better use enterprise tools. prjct is for shipping fast, not ceremonies."
  },
  {
    question: "What if I have many ideas at the same time?",
    answer: "Use /p:idea 'your idea' to quickly capture without losing focus. All are saved in ideas.md. Later you can review with /p:recap and promote the best ones to /p:roadmap add. The system is designed for frictionless quick capture."
  },
  {
    question: "How do I know which command to use for each situation?",
    answer: "Simple rule: /p:now to work, /p:done to finish, /p:ship to celebrate, /p:idea to capture, /p:recap when you're lost. The visual guide above shows you exactly which command to use in each common situation."
  },
  {
    question: "Can I customize commands or add new ones?",
    answer: "Base commands are standardized to maintain simplicity. But: 1) .prjct/ files are markdown - edit them however you want, 2) You can fork the repo and add custom commands, 3) Each command is a .md file that defines its behavior."
  },
  {
    question: "Do I need to know how to code to use prjct?",
    answer: "You don't need to code to use the commands. But prjct is designed for developers - it assumes you're building software. If you don't code, commands still work but will be more useful for technical projects."
  }
]

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <Section
      id="faq"
      title="Real Questions, Real Answers"
      subtitle="The actual questions everyone has (with super clear answers)"
      centered
      maxWidth="2xl"
    >

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
              <div className="p-6 text-muted-foreground">
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
    </Section>
  )
}