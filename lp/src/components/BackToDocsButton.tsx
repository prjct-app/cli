import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export const BackToDocsButton = () => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-8"
    >
      <Link
        to="/docs"
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Documentation</span>
      </Link>
    </motion.div>
  )
}
