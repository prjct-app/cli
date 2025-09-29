import { Github, Globe, Twitter } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PrjctLogo } from './Logo'

export const Footer = () => {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          {/* Logo and Description */}
          <div className="md:w-1/4">
            <PrjctLogo size="sm" />
          </div>

          {/* Resources */}
          <div className="md:w-1/4">
            <h3 className="mb-4 font-semibold">Resources</h3>
            <div className="space-y-2">
              <a
                href="https://github.com/jlopezlira/prjct-cli"
                className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                GitHub
              </a>
              <a
                href="https://github.com/jlopezlira/prjct-cli/blob/main/README.md"
                className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Documentation
              </a>
              <a
                href="https://github.com/jlopezlira/prjct-cli/issues"
                className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Support
              </a>
            </div>
          </div>

          {/* Legal */}
          <div className="md:w-1/4">
            <h3 className="mb-4 font-semibold">Legal</h3>
            <div className="space-y-2">
              <Link
                to="/terms"
                className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Terms of Use
              </Link>
              <Link
                to="/privacy"
                className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy Policy
              </Link>
              <a
                href="https://github.com/jlopezlira/prjct-cli/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                MIT License
              </a>
            </div>
          </div>

          {/* Social Links */}
          <div className="flex gap-6 md:w-1/4 md:justify-end">
            <a
              href="https://github.com/jlopezlira/prjct-cli"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
            <a
              href="https://twitter.com/jlopezlira"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Twitter"
            >
              <Twitter className="h-5 w-5" />
            </a>
            <a
              href="https://jlopezlira.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Made by JJ"
            >
              <Globe className="h-5 w-5" />
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 rounded-lg bg-muted/50 p-4 md:mt-12">
          <p className="text-center text-xs text-muted-foreground">
            <strong>DISCLAIMER:</strong> This software is provided "as is" without warranty of any
            kind. We are not responsible for any damages or losses arising from the use of this
            software. Use at your own risk. By using prjct, you agree to our{' '}
            <Link to="/terms" className="underline hover:text-foreground">
              Terms of Use.
            </Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
