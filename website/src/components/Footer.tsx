import { Mail, Globe, Twitter, Heart, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PrjctLogo } from './Logo'

export const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative mt-20 border-t border-border/50 bg-gradient-to-b from-background to-background/95">
      <div className="container mx-auto max-w-7xl px-6 py-16">
        {/* Top Section - Logo & Description */}
        <div className="mb-12 text-center">
          <div className="inline-block">
            <PrjctLogo size="md" />
          </div>
          <p className="mx-auto mt-6 max-w-md text-sm text-muted-foreground">
            Developer momentum tool for indie hackers and small teams. Ship fast, stay focused, no BS.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Heart className="h-4 w-4 text-cat-red" />
            <span>Built for builders who ship</span>
          </div>
        </div>

        {/* Links Grid */}
        <div className="grid gap-8 border-t border-border/30 pt-12 md:grid-cols-4">
          {/* Product */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Product</h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/docs"
                  className="text-sm text-muted-foreground transition-colors hover:text-cat-teal"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  to="/commands"
                  className="text-sm text-muted-foreground transition-colors hover:text-cat-teal"
                >
                  Commands
                </Link>
              </li>
              <li>
                <Link
                  to="/workflows"
                  className="text-sm text-muted-foreground transition-colors hover:text-cat-teal"
                >
                  Workflows
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Support</h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/faq"
                  className="text-sm text-muted-foreground transition-colors hover:text-cat-blue"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <a
                  href="mailto:jlopezlira@gmail.com"
                  className="text-sm text-muted-foreground transition-colors hover:text-cat-blue"
                >
                  Email Support
                </a>
              </li>
              <li>
                <a
                  href="https://jlopezlira.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground transition-colors hover:text-cat-blue"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Legal</h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/privacy"
                  className="text-sm text-muted-foreground transition-colors hover:text-cat-yellow"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="text-sm text-muted-foreground transition-colors hover:text-cat-yellow"
                >
                  Terms
                </Link>
              </li>
              <li>
                <Link
                  to="/ai-policy"
                  className="text-sm text-muted-foreground transition-colors hover:text-cat-yellow"
                >
                  AI Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Connect</h3>
            <div className="flex gap-3">
              <a
                href="https://discord.gg/5aqtMDUz6"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-500 transition-all hover:from-purple-500/30 hover:to-blue-500/30"
                aria-label="Discord Server"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com/jlopezlira"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-cat-blue/10 text-cat-blue transition-all hover:bg-cat-blue/20"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="https://jlopezlira.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-cat-teal/10 text-cat-teal transition-all hover:bg-cat-teal/20"
                aria-label="Website"
              >
                <Globe className="h-5 w-5" />
              </a>
              <a
                href="mailto:jlopezlira@gmail.com"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-cat-red/10 text-cat-red transition-all hover:bg-cat-red/20"
                aria-label="Email"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="mt-12 border-t border-border/30 pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            © {currentYear} prjct. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
