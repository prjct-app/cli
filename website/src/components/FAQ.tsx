import { motion } from 'framer-motion'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Section } from './ui'

const faqs = [
  {
    question: 'Why Claude-only? What about Cursor/Windsurf?',
    answer:
      "By focusing 100% on Claude, we deliver features that would be IMPOSSIBLE with multi-platform support:\n\n1. Dynamic AI Agents (requires Claude's agent system)\n2. Native MCP Integration (Claude-native protocol)\n3. Git Validation (needs tight Claude integration)\n4. Natural Language (leverages Claude's understanding)\n5. 50-60% less code = faster features & bug fixes\n\nThis isn't a limitation - it's a strategic decision that makes prjct-cli better for developers who ship fast. Works with whatever Claude subscription you have (free tier or Pro) - no extra costs, tokens, or API keys to configure.",
  },
  {
    question: 'Is this a project management tool?',
    answer:
      "NO. prjct-cli is a DEVELOPER MOMENTUM TOOL for indie hackers and small teams (2-5 devs).\n\nWhat it IS: Ship fast, track progress, stay focused, celebrate wins.\n\nWhat it's NOT: No Jira, no sprint planning, no story points, no burndown charts, no ceremonies, no meetings.\n\nPhilosophy: /p:now → work → /p:done → /p:ship → celebrate. Just ship it, no BS.",
  },
  {
    question: "I prefer Cursor/Windsurf. Can't you add them back?",
    answer:
      "We deliberately chose NOT to support multi-platform:\n\n• No extra setup - works with whatever Claude subscription you have (free tier or Pro)\n• No token management - uses your current Claude access and limits\n• Better AI (latest Claude 3.5 Sonnet vs older models)\n• Enables impossible features (agents, MCP, git validation)\n• 50-60% less code = better quality & faster features\n\nYou can stay on v0.4.10 if needed, but you'll miss out on superpowers. Give Claude Code a try - just install and use with your existing Claude access.",
  },
  {
    question: 'Can I work on multiple tasks simultaneously?',
    answer:
      'NO by design. prjct enforces SINGLE FOCUS to maximize developer momentum. If you need to switch context, use /p:done first, then /p:now for the new task. This is intentional - multitasking kills productivity.',
  },
  {
    question: "What's the difference between /p:done and /p:ship?",
    answer:
      "/p:done = Finish ANY task and clear focus.\n/p:ship = Celebrate a FEATURE you shipped.\n\nExample:\n• /p:done for 'fix typo in README'\n• /p:ship 'authentication system' 🎉\n\nShipping is special - it deserves celebration!",
  },
  {
    question: 'What happens with my data? Where is it stored?',
    answer:
      "EVERYTHING is local in ~/.prjct-cli/projects/{your-project-id}/\n\n• No cloud tracking\n• No data mining\n• No telemetry\n• No BS\n\nYou own your data. Version it with git, backup it, edit it manually (it's markdown), or delete it anytime.",
  },
  {
    question: 'Does it work with teams or only solo developers?',
    answer:
      'Perfect for:\n\n✅ Solo indie hackers\n✅ Small teams (2-5 devs)\n\n❌ NOT for large enterprises (use proper PM tools)\n\nTeam workflow:\n1. Share ~/.prjct-cli/projects/ via git\n2. Everyone uses Claude Code or Desktop\n3. Same context, same progress, zero meetings\n\nFor >5 devs, you need enterprise tools with proper PM.',
  },
  {
    question: 'How do I migrate from Jira/Linear/Trello?',
    answer:
      "You DON'T migrate. Start fresh:\n\n1. /p:init to initialize\n2. Edit roadmap.md with your current features\n3. /p:now for today's task\n4. Ship, don't plan\n\nprjct is anti-PM. Leave the ceremony behind, just ship.",
  },
  {
    question: 'Can I use prjct without Claude?',
    answer:
      "Yes, but with VERY limited features (Terminal mode only):\n\n✅ Basic commands work\n❌ No AI agents\n❌ No MCP integration\n❌ No git validation\n❌ No natural language\n\nFor the full experience, use Claude Code or Desktop with whatever subscription you have (free tier or Pro). No extra setup required.",
  },
  {
    question: 'What if I have many ideas at the same time?',
    answer:
      "Use /p:idea 'your idea' for frictionless capture without losing focus. All ideas saved to ideas.md.\n\nReview later with /p:recap and promote the best ones to roadmap.md. The system is designed for quick capture, not planning sessions.",
  },
  {
    question: 'Can I customize commands or add new ones?',
    answer:
      'Base commands are standardized for simplicity. But:\n\n1. All files are markdown - edit them however you want\n2. Fork the repo and add custom commands\n3. Each command is a .md file in ~/.claude/commands/p/\n\nCustomize locally, but core commands stay simple by design.',
  },
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
            className="overflow-hidden rounded-xl border border-border"
          >
            <button
              onClick={() => toggleFAQ(index)}
              className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-muted/30"
            >
              <span className="text-lg font-medium">{faq.question}</span>
              <motion.div
                animate={{ rotate: openIndex === index ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </motion.div>
            </button>

            <motion.div
              initial={false}
              animate={{
                height: openIndex === index ? 'auto' : 0,
                opacity: openIndex === index ? 1 : 0,
              }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="p-6 text-muted-foreground">{faq.answer}</div>
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
        <p className="mb-4 text-muted-foreground">Still have questions?</p>
        <a
          href="https://github.com/jlopezlira/prjct-cli/issues"
          className="inline-flex items-center gap-2 text-foreground transition-colors hover:text-primary"
        >
          <span>Ask on GitHub</span>
          <span>→</span>
        </a>
      </motion.div>
    </Section>
  )
}
