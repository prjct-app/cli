import { Link } from 'react-router-dom'
import { Hero } from '../components/Hero'
import { TerminalCTA } from '../components/TerminalCTA'
import WorkflowMap from '../components/WorkflowMap'
import { HowItWorks } from '../components/HowItWorks'
import { Features } from '../components/Features'
import { ClaudeSuperpowers } from '../components/ClaudeSuperpowers'
import { ForIndies } from '../components/ForIndies'
import { motion } from 'framer-motion'

export const Home = () => {
  return (
    <>
      <Hero />
      <TerminalCTA />
      <WorkflowMap />
      <HowItWorks />
      <Features />
      <ClaudeSuperpowers />
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
          <h2 className="mb-6 text-3xl font-bold md:text-4xl">
            Ready to <span className="hunt-glow">Ship</span> Faster?
          </h2>
          <p className="mb-8 text-xl text-muted-foreground">
            Join indie hackers and small teams who ship features, not meetings
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              to="/docs"
              className="rounded-lg bg-primary px-8 py-3 text-primary-foreground transition-all hover:opacity-90"
            >
              Get Started →
            </Link>
            <Link
              to="/commands"
              className="rounded-lg border border-border px-8 py-3 transition-all hover:bg-muted"
            >
              View Commands
            </Link>
          </div>

          {/* Product Hunt */}
          <div className="mt-8 flex justify-center">
            <a
              href="https://www.producthunt.com/products/prjct-cli?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-prjct-cli"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-transform hover:scale-105"
            >
              <img
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1021356&theme=dark&t=1759203826693"
                alt="prjct/cli - Built for Claude - Ship Fast, No BS | Product Hunt"
                style={{ width: '250px', height: '54px' }}
                width="250"
                height="54"
              />
            </a>
          </div>
        </motion.div>
      </section>
    </>
  )
}
