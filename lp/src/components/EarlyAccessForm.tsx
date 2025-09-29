import { motion } from 'framer-motion'
import { Github, ArrowRight } from 'lucide-react'

const EarlyAccessForm = () => {
  const githubIssueUrl =
    'https://github.com/jlopezlira/prjct-cli/issues/new?labels=Windsurf+Extension&title=Early+Access+Request&body=I%27m+interested+in+early+access+to+the+Windsurf+Extension!'

  const handleGitHubClick = () => {
    window.open(githubIssueUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="relative">
      {/* Background Decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-500/5 to-blue-500/5 blur-xl" />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur-md md:p-12"
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20"
          >
            <Github className="h-7 w-7 text-cat-mauve" />
          </motion.div>

          <h3 className="mb-3 text-3xl font-bold">
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Join the Waitlist
            </span>
          </h3>

          <p className="mx-auto mb-6 max-w-md text-muted-foreground">
            Be among the first to experience visual project metrics in your editor. Request early
            access through GitHub.
          </p>

          {/* GitHub Button */}
          <motion.button
            onClick={handleGitHubClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-8 py-4 font-medium text-white transition-all duration-300"
          >
            <Github className="h-5 w-5" />
            <span>Request Early Access on GitHub</span>
            <ArrowRight className="h-4 w-4" />
          </motion.button>

          {/* Note */}
          <p className="mt-4 text-xs text-muted-foreground">
            Opens a GitHub issue to track your interest
          </p>
        </div>

        {/* Features Preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 border-t border-border/50 pt-8"
        >
          <p className="mb-4 text-center text-sm text-muted-foreground">
            What you'll get with early access:
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { title: 'Beta Access', desc: 'Try before public launch' },
              { title: 'Shape Features', desc: 'Your feedback matters' },
              { title: 'Lifetime Updates', desc: 'All future improvements' },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="text-center"
              >
                <div className="mb-1 text-sm font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default EarlyAccessForm
