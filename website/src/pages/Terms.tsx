import { motion } from 'framer-motion'
import { Scale, Shield, AlertCircle, FileText } from 'lucide-react'

export const Terms = () => {
  return (
    <div className="min-h-screen px-4 py-20">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
            <Scale className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Legal Agreement</span>
          </div>
          <h1 className="mb-6 text-5xl font-bold md:text-6xl">Terms of Use</h1>
          <p className="text-xl text-muted-foreground">Last updated: January 2025</p>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="prose prose-invert max-w-none"
        >
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
              <FileText className="h-6 w-6" />
              1. Acceptance of Terms
            </h2>
            <p className="text-muted-foreground">
              By downloading, installing, or using prjct ("the Software"), you agree to be bound by
              these Terms of Use. If you do not agree to these terms, do not use the Software.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">2. License and Usage</h2>
            <p className="text-muted-foreground">
              prjct is proprietary software. You are granted a license to use the Software for
              personal and commercial purposes. The FREE tier is available to all users indefinitely.
              Additional PRO features may be available through optional paid upgrades.
            </p>
          </section>

          <section className="mb-8 rounded-lg bg-cat-red/10 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-cat-red">
              <AlertCircle className="h-6 w-6" />
              3. No Warranty
            </h2>
            <p className="font-semibold text-cat-red">IMPORTANT DISCLAIMER:</p>
            <p className="mt-2 text-sm text-muted-foreground">
              THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
              INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
              HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
              CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
              OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">4. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              Under no circumstances shall the creators, contributors, or copyright holders of prjct
              be liable for any direct, indirect, incidental, special, exemplary, or consequential
              damages (including, but not limited to, procurement of substitute goods or services;
              loss of use, data, or profits; or business interruption) however caused and on any
              theory of liability, whether in contract, strict liability, or tort (including
              negligence or otherwise) arising in any way out of the use of this Software, even if
              advised of the possibility of such damage.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">5. Use at Your Own Risk</h2>
            <p className="text-muted-foreground">
              You acknowledge that you use prjct at your own risk. The Software is a project
              management tool that integrates with AI assistants. We do not guarantee the accuracy,
              completeness, or usefulness of any information provided by the Software or its AI
              integrations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
              <Shield className="h-6 w-6" />
              6. Data Storage
            </h2>
            <p className="text-muted-foreground">
              prjct stores all data locally on your machine in a <code>.prjct</code> folder. We do
              not collect, transmit, or store any of your data on our servers. You are responsible
              for backing up your own data. We are not responsible for any data loss.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">7. AI Integration</h2>
            <p className="text-muted-foreground">
              prjct integrates with various AI assistants (Claude Code, Cursor, OpenAI Codex, Warp
              Code, etc.). Your use of these AI services is subject to their respective terms of
              service. We are not responsible for the behavior, availability, or outputs of these AI
              services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">8. Modifications</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these Terms of Use at any time. Continued use of the
              Software after any such changes constitutes your acceptance of the new Terms of Use.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">9. Indemnification</h2>
            <p className="text-muted-foreground">
              You agree to indemnify and hold harmless the creators and contributors of prjct from
              any claims, damages, losses, liabilities, and expenses arising from your use of the
              Software.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">10. Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms shall be governed by and construed in accordance with applicable laws,
              without regard to conflict of law principles.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">11. Contact</h2>
            <p className="text-muted-foreground">
              For questions about these Terms of Use, please contact us at{' '}
              <a
                href="mailto:jlopezlira@gmail.com"
                className="text-primary underline hover:no-underline"
              >
                jlopezlira@gmail.com
              </a>{' '}
              or visit{' '}
              <a
                href="https://jlopezlira.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                jlopezlira.dev
              </a>
              .
            </p>
          </section>

          {/* Final notice */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-12 rounded-lg bg-primary/10 p-6"
          >
            <p className="text-center font-semibold">
              By using prjct, you acknowledge that you have read, understood, and agree to be bound
              by these Terms of Use.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
