import { motion } from 'framer-motion'
import { Sparkles, Shield, AlertCircle, Eye, Lock, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

export const AIPolicy = () => {
  return (
    <div className="min-h-screen px-4 py-20">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Artificial Intelligence</span>
          </div>
          <h1 className="mb-6 text-5xl font-bold md:text-6xl">AI Policy</h1>
          <p className="text-xl text-muted-foreground">Last updated: January 2025</p>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="prose prose-invert max-w-none"
        >
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
              <Sparkles className="h-6 w-6" />
              What is prjct?
            </h2>
            <p className="text-muted-foreground">
              prjct is an agentic AI tool designed to help developers ship features faster. We
              integrate with AI assistants (Claude Code, Cursor, and others) to provide intelligent
              project management, task tracking, and development momentum tools.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">How prjct Uses AI</h2>
            <p className="text-muted-foreground">
              prjct operates as a command-line interface that integrates with your chosen AI
              assistant. Our tool:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                • Processes your project files and code to provide context-aware task management
              </li>
              <li>
                • Sends information to AI services (like Claude) to generate intelligent
                recommendations
              </li>
              <li>• Analyzes your codebase to suggest appropriate development workflows</li>
              <li>• Generates task breakdowns and progress summaries based on your work</li>
            </ul>
          </section>

          <section className="mb-8 rounded-lg bg-cat-blue/10 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-cat-blue">
              <Shield className="h-6 w-6" />
              User Control & Safety
            </h2>
            <p className="font-semibold text-cat-blue">IMPORTANT SAFEGUARDS:</p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Plan Mode:</strong> All prjct commands require explicit user confirmation
                before execution. We never make changes to your code or files without your approval.
              </p>
              <p>
                <strong>Local-First:</strong> All your data stays on your machine in{' '}
                <code>~/.prjct-cli/</code>. We don't collect, store, or transmit your data to our
                servers.
              </p>
              <p>
                <strong>Transparency:</strong> Before executing any command, we show you exactly
                what will be done and wait for your confirmation.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
              <Eye className="h-6 w-6" />
              Data Processing
            </h2>
            <p className="text-muted-foreground">
              When you use prjct with an AI assistant (like Claude Code):
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                • Your code and project files are processed by the AI assistant you're using (e.g.,
                Claude, Cursor)
              </li>
              <li>
                • We rely on these third-party AI services to generate recommendations and responses
              </li>
              <li>
                • Your use of these AI services is subject to their respective terms of service and
                privacy policies
              </li>
              <li>
                • prjct itself does not train AI models or use your code for model training
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
              <Lock className="h-6 w-6" />
              Third-Party AI Services
            </h2>
            <p className="text-muted-foreground">
              prjct integrates with various AI assistants and services. You should review their
              policies:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                • <strong>Anthropic Claude:</strong> Used for code analysis and recommendations
              </li>
              <li>
                • <strong>Other AI Assistants:</strong> Cursor, Windsurf, and compatible tools
              </li>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              We are not responsible for the behavior, availability, or data practices of these
              third-party services.
            </p>
          </section>

          <section className="mb-8 rounded-lg bg-cat-red/10 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-cat-red">
              <AlertCircle className="h-6 w-6" />
              AI Limitations & Responsibilities
            </h2>
            <p className="font-semibold text-cat-red">PLEASE NOTE:</p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>
                AI-generated content may be inaccurate, incomplete, or inappropriate for your
                specific use case. Always review recommendations before acting on them.
              </p>
              <p>
                Code suggestions should be reviewed for security vulnerabilities, correctness, and
                compliance with your project's requirements.
              </p>
              <p>
                AI models may produce biased or unexpected outputs. Use professional judgment when
                implementing AI-generated suggestions.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
              <Users className="h-6 w-6" />
              User Responsibilities
            </h2>
            <p className="text-muted-foreground">When using prjct, you agree to:</p>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                • Review all AI-generated recommendations before implementing them in production code
              </li>
              <li>
                • Comply with your AI assistant's terms of service (Claude, Cursor, etc.)
              </li>
              <li>• Not use prjct to generate harmful, illegal, or unethical content</li>
              <li>
                • Take full responsibility for code and decisions made based on AI recommendations
              </li>
              <li>
                • Understand that AI suggestions are tools to assist, not replace, professional
                judgment
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">FREE vs PRO Tiers</h2>
            <p className="text-muted-foreground">
              <strong>FREE tier:</strong> Available to all users indefinitely with full access to
              core AI-powered features.
            </p>
            <p className="mt-2 text-muted-foreground">
              <strong>PRO tier (coming soon):</strong> Optional paid upgrade with additional
              features and capabilities.
            </p>
            <p className="mt-2 text-muted-foreground">
              Both tiers follow the same AI policy and safety guidelines outlined here.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">Why We Made This Decision</h2>
            <p className="text-muted-foreground">
              We believe in building honest products. As an agentic AI tool that processes your code
              and interacts with AI services, we're not certain about potential conflicts with
              third-party terms of service, especially AI provider policies.
            </p>
            <p className="mt-3 text-muted-foreground">
              Rather than risk affecting our users or violating terms we don't fully understand,
              we've made our codebase proprietary while we clarify these concerns. This lets us
              develop responsibly and prioritize user safety.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">Updates to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this AI Policy periodically to reflect changes in our practices or
              regulatory requirements. Continued use of prjct after updates constitutes acceptance
              of the revised policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">Contact</h2>
            <p className="text-muted-foreground">
              For questions about this AI Policy, please contact us at{' '}
              <a
                href="mailto:jlopezlira@gmail.com"
                className="text-primary underline hover:no-underline"
              >
                jlopezlira@gmail.com
              </a>{' '}
              or visit{' '}
              <a
                href="https://jlopezlira.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                jlopezlira.dev
              </a>
              .
            </p>
          </section>

          {/* Final notice */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-12 rounded-lg bg-primary/10 p-6"
          >
            <p className="text-center font-semibold">
              By using prjct, you acknowledge that you have read, understood, and agree to be bound
              by this AI Policy and our{' '}
              <Link to="/terms" className="text-primary underline hover:no-underline">
                Terms of Use
              </Link>
              .
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
