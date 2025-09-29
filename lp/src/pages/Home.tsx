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
      <section className="bg-gradient-to-t from-primary/5 to-transparent px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mx-auto max-w-4xl text-center"
        >
          <h2 className="mb-6 text-3xl font-bold md:text-4xl">Ready to Ship Faster?</h2>
          <p className="mb-8 text-xl text-muted-foreground">
            Join thousands of indie hackers who ship features, not meetings
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="https://github.com/jlopezlira/prjct-cli"
              className="rounded-lg bg-primary px-8 py-3 text-primary-foreground transition-all hover:opacity-90"
            >
              Get Started →
            </a>
            <Link
              to="/docs"
              className="rounded-lg border border-border px-8 py-3 transition-all hover:bg-muted"
            >
              View Documentation
            </Link>
          </div>
        </motion.div>
      </section>
    </>
  )
}
