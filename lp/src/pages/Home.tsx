import { Link } from 'react-router-dom'
import { Hero } from '../components/Hero'
import { Terminal } from '../components/Terminal'
import { Features } from '../components/Features'
import { Compatibility } from '../components/Compatibility'
import { ForIndies } from '../components/ForIndies'
import WindsurfExtension from '../components/WindsurfExtension'
import { motion } from 'framer-motion'

export const Home = () => {
 return (
  <>
   <Hero />
   <Terminal />
   <Features />
   <Compatibility />
   <WindsurfExtension />
   <ForIndies />

   {/* Call to Action Section */}
   <section className="py-20 px-4 bg-gradient-to-t from-primary/5 to-transparent">
    <motion.div
     initial={{ opacity: 0, y: 20 }}
     whileInView={{ opacity: 1, y: 0 }}
     transition={{ duration: 0.6 }}
     viewport={{ once: true }}
     className="max-w-4xl mx-auto text-center"
    >
     <h2 className="text-3xl md:text-4xl font-bold mb-6">
      Ready to Ship Faster?
     </h2>
     <p className="text-xl text-muted-foreground mb-8">
      Join thousands of indie hackers who ship features, not meetings
     </p>
     <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <a
       href="https://github.com/jlopezlira/prjct-cli"
       className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all"
      >
       Get Started →
      </a>
      <Link
       to="/docs"
       className="px-8 py-3 border border-border rounded-lg hover:bg-muted transition-all"
      >
       View Documentation
      </Link>
     </div>
    </motion.div>
   </section>
  </>
 )
}