import { FAQ } from '../components/FAQ'
import { motion } from 'framer-motion'
import { HelpCircle, MessageCircle, GitBranch } from 'lucide-react'

export const FAQPage = () => {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="bg-gradient-to-b from-primary/5 to-transparent px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
            <HelpCircle className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Get Answers</span>
          </div>
          <h1 className="mb-6 text-5xl font-bold md:text-6xl">Frequently Asked Questions</h1>
          <p className="text-xl text-muted-foreground">
            Real questions from real developers, with clear answers
          </p>
        </motion.div>
      </section>

      {/* FAQ Component */}
      <FAQ />

      {/* Support Section */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="rounded-2xl bg-muted/20 p-8 text-center"
          >
            <h2 className="mb-6 text-2xl font-bold">Still Have Questions?</h2>
            <p className="mb-8 text-muted-foreground">
              We're here to help! Choose the best way to get support:
            </p>
            <div className="mx-auto grid max-w-2xl gap-4 md:grid-cols-2">
              <a
                href="https://github.com/jlopezlira/prjct-cli/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-lg border border-border p-4 transition-all hover:bg-muted/50"
              >
                <GitBranch className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <div className="font-semibold transition-colors group-hover:text-primary">
                    GitHub Issues
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Report bugs or request features
                  </div>
                </div>
              </a>
              <a
                href="https://github.com/jlopezlira/prjct-cli/discussions"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-lg border border-border p-4 transition-all hover:bg-muted/50"
              >
                <MessageCircle className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <div className="font-semibold transition-colors group-hover:text-primary">
                    Discussions
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Join the community conversation
                  </div>
                </div>
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
