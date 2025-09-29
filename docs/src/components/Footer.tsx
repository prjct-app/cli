import { Github, Globe, Twitter } from 'lucide-react'
import { PrjctLogo } from './Logo'

export const Footer = () => {

  return (
    <footer className="py-12 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="flex gap-8 mb-8 justify-between items-start">
          {/* Logo and Description */}
          <div>
            <PrjctLogo size="sm" />
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold mb-4">Resources</h3>
            <div className="space-y-2">
              <a
                href="https://github.com/jlopezlira/prjct-cli"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://github.com/jlopezlira/prjct-cli/blob/main/README.md"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Documentation
              </a>
              <a
                href="https://github.com/jlopezlira/prjct-cli/issues"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Support
              </a>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <div className="space-y-2">
              <a
                href="https://github.com/jlopezlira/prjct-cli/blob/main/TERMS.md"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms of Use
              </a>
              <a
                href="https://github.com/jlopezlira/prjct-cli/blob/main/PRIVACY.md"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy Policy
              </a>
              <a
                href="https://github.com/jlopezlira/prjct-cli/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
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
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="https://twitter.com/jlopezlira"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Twitter"
            >
              <Twitter className="w-5 h-5" />
            </a>
            <a
              href="https://jlopezlira.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Made by JJ"
            >
              <Globe className="w-5 h-5" />
            </a>
          </div>
        </div>



        {/* Disclaimer */}
        <div className="my-8 p-4 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            <strong>DISCLAIMER:</strong> This software is provided "as is" without warranty of any kind.
            We are not responsible for any damages or losses arising from the use of this software.
            Use at your own risk. By using prjct, you agree to our{' '}
            <a
              href="https://github.com/jlopezlira/prjct-cli/blob/main/TERMS.md"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Terms of Use
            </a>.
          </p>
        </div>
      </div>
    </footer>
  )
}