import { Github, Globe, Twitter, Shield, Code2, Heart, ExternalLink, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PrjctLogo } from './Logo'

export const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative mt-20 border-t border-border/50 bg-gradient-to-b from-background to-background/95">
      <div className="container mx-auto max-w-7xl px-6">
        {/* Main footer content */}
        <div className="grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-5">
          {/* Logo and Description */}
          <div className="lg:col-span-2">
            <PrjctLogo size="sm" />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Developer momentum tool for indie hackers and small teams. Ship fast, stay focused, no
              BS.
            </p>
            <div className="mt-6 flex items-center gap-1 text-xs text-muted-foreground">
              <Heart className="h-3 w-3 text-cat-red" />
              <span>Built for builders who ship</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground/80">
              <BookOpen className="h-4 w-4" />
              Learn
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/docs"
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-cat-green"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  to="/commands"
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-cat-green"
                >
                  Commands
                </Link>
              </li>
              <li>
                <Link
                  to="/workflows"
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-cat-green"
                >
                  Workflows
                </Link>
              </li>
              <li>
                <Link
                  to="/faq"
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-cat-green"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground/80">
              <Code2 className="h-4 w-4" />
              Develop
            </h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://github.com/jlopezlira/prjct-cli"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-cat-blue"
                >
                  GitHub
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/jlopezlira/prjct-cli/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-cat-blue"
                >
                  Issues
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/jlopezlira/prjct-cli/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-cat-blue"
                >
                  Discussions
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground/80">
              <Shield className="h-4 w-4" />
              Legal
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/privacy"
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-cat-yellow"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-cat-yellow"
                >
                  Terms of Use
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/jlopezlira/prjct-cli/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-cat-yellow"
                >
                  MIT License
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="border-t border-border/50 py-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            {/* Copyright */}
            <p className="text-sm text-muted-foreground">
              © {currentYear} prjct. All rights reserved.
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/jlopezlira/prjct-cli"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-muted/50 p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="https://twitter.com/jlopezlira"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-muted/50 p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="https://jlopezlira.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-muted/50 p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                aria-label="Personal Website"
              >
                <Globe className="h-4 w-4" />
              </a>
            </div>

            {/* Made by */}
            <p className="text-sm text-muted-foreground">
              Made with <span className="text-cat-red">♥</span> by{' '}
              <a
                href="https://jlopezlira.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground/80 transition-colors hover:text-cat-green"
              >
                JJ
              </a>
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="border-t border-border/30 py-6">
          <p className="text-center text-xs leading-relaxed text-muted-foreground/70">
            <strong className="font-medium">DISCLAIMER:</strong> This software is provided "as is"
            without warranty of any kind. We are not responsible for any damages or losses arising
            from the use of this software. Use at your own risk. By using prjct, you agree to our{' '}
            <Link to="/terms" className="underline underline-offset-2 hover:text-foreground/80">
              Terms of Use
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  )
}
