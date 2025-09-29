import { FAQ } from '../components/FAQ'
import { motion } from 'framer-motion'
import { HelpCircle, MessageCircle, GitBranch } from 'lucide-react'

export const FAQPage = () => {
 return (
  <div className="min-h-screen">
   {/* Header */}
   <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-transparent">
    <motion.div
     initial={{ opacity: 0, y: 20 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6 }}
     className="max-w-4xl mx-auto text-center"
    >
     <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6">
      <HelpCircle className="w-4 h-4 text-primary" />
      <span className="text-sm font-medium text-primary">Get Answers</span>
     </div>
     <h1 className="text-5xl md:text-6xl font-bold mb-6">
      Frequently Asked Questions
     </h1>
     <p className="text-xl text-muted-foreground">
      Real questions from real developers, with clear answers
     </p>
    </motion.div>
   </section>

   {/* FAQ Component */}
   <FAQ />

   {/* Support Section */}
   <section className="py-20 px-4">
    <div className="max-w-4xl mx-auto">
     <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="bg-muted/20 rounded-2xl p-8 text-center"
     >
      <h2 className="text-2xl font-bold mb-6">Still Have Questions?</h2>
      <p className="text-muted-foreground mb-8">
       We're here to help! Choose the best way to get support:
      </p>
      <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
       <a
        href="https://github.com/jlopezlira/prjct-cli/issues"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-muted/50 transition-all group"
       >
        <GitBranch className="w-5 h-5 text-primary" />
        <div className="text-left">
         <div className="font-semibold group-hover:text-primary transition-colors">
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
        className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-muted/50 transition-all group"
       >
        <MessageCircle className="w-5 h-5 text-primary" />
        <div className="text-left">
         <div className="font-semibold group-hover:text-primary transition-colors">
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