import { Github, Globe, Twitter } from 'lucide-react'
import { PrjctLogo } from './Logo'

export const Footer = () => {
  return (
    <footer className="border-t border-border px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-8">
          {/* Logo and Description */}
          <div>
            <PrjctLogo size="sm" />
          </div>

          {/* Resources */}
          <div>
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
          <div>
            <h3 className="mb-4 font-semibold">Legal</h3>
            <div className="space-y-2">
              <a
                href="https://github.com/jlopezlira/prjct-cli/blob/main/TERMS.md"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Terms of Use
              </a>
              <a
                href="https://github.com/jlopezlira/prjct-cli/blob/main/PRIVACY.md"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy Policy
              </a>
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
          <div className="flex items-center gap-6">
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
        <div className="my-8 rounded-lg bg-muted/50 p-4">
          <p className="text-center text-xs text-muted-foreground">
            <strong>DISCLAIMER:</strong> This software is provided "as is" without warranty of any
            kind. We are not responsible for any damages or losses arising from the use of this
            software. Use at your own risk. By using prjct, you agree to our{' '}
            <a
              href="https://github.com/jlopezlira/prjct-cli/blob/main/TERMS.md"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Terms of Use.
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
