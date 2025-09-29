import { motion } from 'framer-motion'
import { Github, ArrowRight } from 'lucide-react'

const EarlyAccessForm = () => {
  const githubIssueUrl = 'https://github.com/jlopezlira/prjct-cli/issues/new?labels=Windsurf+Extension&title=Early+Access+Request&body=I%27m+interested+in+early+access+to+the+Windsurf+Extension!'

  const handleGitHubClick = () => {
    window.open(githubIssueUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="relative">
      {/* Background Decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5 rounded-3xl blur-xl" />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative bg-card/50 backdrop-blur-md rounded-2xl border border-border/50 p-8 md:p-12"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 mb-4"
          >
            <Github className="w-7 h-7 text-purple-500" />
          </motion.div>

          <h3 className="text-3xl font-bold mb-3">
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Join the Waitlist
            </span>
          </h3>

          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Be among the first to experience visual project metrics in your editor.
            Request early access through GitHub.
          </p>

          {/* GitHub Button */}
          <motion.button
            onClick={handleGitHubClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-medium transition-all duration-300"
          >
            <Github className="w-5 h-5" />
            <span>Request Early Access on GitHub</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          {/* Note */}
          <p className="text-xs text-muted-foreground mt-4">
            Opens a GitHub issue to track your interest
          </p>
        </div>

        {/* Features Preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 pt-8 border-t border-border/50"
        >
          <p className="text-sm text-center text-muted-foreground mb-4">
            What you'll get with early access:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { title: "Beta Access", desc: "Try before public launch" },
              { title: "Shape Features", desc: "Your feedback matters" },
              { title: "Lifetime Updates", desc: "All future improvements" }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="text-center"
              >
                <div className="text-sm font-medium mb-1">{item.title}</div>
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