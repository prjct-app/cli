import { motion } from 'framer-motion'
import {
  GitBranch,
  AlertTriangle,
  Plus,
  Wrench,
  Shield,
  Users,
  CheckCircle,
  Bug,
  RefreshCw,
  Package,
  Sparkles,
  ArrowRightLeft,
  MessageSquare,
} from 'lucide-react'
import { VersionHeader } from '@/components/changelog/VersionHeader'
import { FeatureCard } from '@/components/ui/FeatureCard'
import { DateSection } from '@/components/changelog/DateSection'
import { TimelineNav } from '@/components/changelog/TimelineNav'

export const Changelog = () => {
  // Timeline navigation items
  const timelineItems = [
    { id: 'nov-22-2025', date: 'Nov 22, 2025', releaseCount: 1 },
    { id: 'oct-6-2025', date: 'Oct 6, 2025', releaseCount: 1 },
    { id: 'oct-5-2025', date: 'Oct 5, 2025', releaseCount: 5 },
    { id: 'oct-4-2025', date: 'Oct 4, 2025', releaseCount: 3 },
    { id: 'oct-3-2025', date: 'Oct 3, 2025', releaseCount: 1 },
    { id: 'oct-2-2025', date: 'Oct 2, 2025', releaseCount: 7 },
    { id: 'oct-1-2025', date: 'Oct 1, 2025', releaseCount: 4 },
  ]

  return (
    <div className="min-h-screen px-4 py-20">
      {/* Timeline Navigation */}
      <TimelineNav items={timelineItems} />

      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Version History</span>
          </div>
          <h1 className="mb-6 text-5xl font-bold md:text-6xl">Changelog</h1>
          <p className="text-xl text-muted-foreground">
            Track every improvement, feature, and change in prjct. We ship fast and iterate
            constantly.
          </p>
        </motion.div>

        {/* November 22, 2025 - 1 release */}
        <DateSection id="nov-22-2025" date="November 22, 2025" releaseCount={1}>
          {/* Version 0.9.1 - Command Registry Refactor & Context Optimization */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.9.1" isLatest />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="fancy"
                contentLayout="horizontal"
                icon={Sparkles}
                title="Revolutionary Task Stack System - Pause & Resume ANY task"
                description="The biggest workflow improvement yet. Handle interruptions naturally."
                bullets={[
                  '• NEW: /p:pause - Pause any task instantly when interrupted',
                  '• NEW: /p:resume - Pick up exactly where you left off',
                  '• Multiple tasks can be paused simultaneously',
                  '• Context preserved perfectly - never lose your flow',
                  '• Tracks active vs paused time for accurate metrics',
                ]}
              />

              <FeatureCard
                variant="fancy"
                contentLayout="horizontal"
                icon={RefreshCw}
                title="Mandatory Agent Routing - Every task gets an expert"
                description="ALL tasks now run through specialized AI agents. No exceptions."
                bullets={[
                  '• 100% agent coverage - every task assigned to a specialist',
                  '• Context filtering reduces token usage by 70-90%',
                  '• Each agent only sees relevant files for their domain',
                  '• Frontend agent skips backend files, backend skips CSS, etc.',
                  '• Faster, more accurate, cheaper to run',
                ]}
              />

              <FeatureCard
                variant="fancy"
                contentLayout="horizontal"
                icon={Package}
                title="Architecture Generator powered by enterprise methodologies"
                description="Transform ideas into complete technical specs using proven frameworks"
                bullets={[
                  '• NEW: /p:idea "build a CRM" → Complete architecture',
                  '• Uses DDD (Domain-Driven Design), JTBD (Jobs to be Done), Contract-First API',
                  '• 8-phase process: Discovery → User Flows → Domain → API → Architecture → Data → Stack → Roadmap',
                  '• Generates database schemas, API specs, tech recommendations',
                  '• MVP-focused with 4-week sprint roadmaps',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={CheckCircle}
                title="Command Consolidation - Less commands, more power"
                description="Merged similar commands for a cleaner, more intuitive interface"
                bullets={[
                  '• /p:work replaces /p:now + /p:build (unified task management)',
                  '• /p:dash replaces status + recap + progress + roadmap (4→1)',
                  '• /p:help absorbs ask + suggest + stuck (smarter context help)',
                  '• 30% fewer commands, 100% more functionality',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Bug}
                title="Intelligent Memory Management"
                description="Handles massive projects without slowing down"
                bullets={[
                  '• New JSONL helper for efficient large file operations',
                  '• Session-based architecture prevents memory leaks',
                  '• Legacy installation detector cleans old curl installs',
                  '• 84% reduction in core code (3103 → 306 lines)',
                ]}
              />
            </div>
          </motion.section>
        </DateSection>

        {/* October 6, 2025 - 1 release */}
        <DateSection id="oct-6-2025" date="October 6, 2025" releaseCount={1}>
          {/* Version 0.8.8 - Timestamps, Templates, Legacy Cleanup & Windows */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.8.8" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="fancy"
                contentLayout="horizontal"
                icon={Bug}
                title="Your tasks said January 1st when it's October"
                description="The LLM can't tell time. So we taught it to ask."
                bullets={[
                  '• Before: Tasks showing January 1st dates in October (wat?)',
                  '• Why: LLM knowledge cutoff is January 2025 - it literally doesn\'t know what day it is',
                  '• Now: New GetTimestamp() tools give LLM real system time',
                  '• Result: Session files use correct dates, analytics actually work',
                ]}
              />

              <FeatureCard
                variant="fancy"
                contentLayout="horizontal"
                icon={Sparkles}
                title="Templates got 70% smaller (and faster)"
                description="Top 7 templates: 2006 lines → 605 lines. Same logic, way less fluff."
                bullets={[
                  '• Cut verbose examples LLM doesn\'t need',
                  '• Converted all Spanish to English',
                  '• Preserved 100% of decision-making logic',
                  '• Faster processing, lower token usage',
                ]}
              />

              <FeatureCard
                variant="fancy"
                contentLayout="horizontal"
                icon={RefreshCw}
                title="Old curl installs? We clean them up for you"
                description="If you installed via curl before v0.8.2, we automatically migrate you to npm."
                bullets={[
                  '• Detects legacy ~/.prjct-cli/ from old curl install.sh',
                  '• Migrates your project data safely to npm location',
                  '• Removes old installation files (bin/, core/, templates/)',
                  '• Cleans shell PATH entries (bash/zsh/PowerShell)',
                  '• Zero manual steps - happens on first run after npm install',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Package}
                title="Windows works now"
                description="Full cross-platform support for Windows users"
                bullets={[
                  '• PowerShell profile cleanup (not bash/zsh)',
                  '• Platform detection via process.platform',
                  '• Command installer already cross-platform',
                  '• All core features work on Windows',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={CheckCircle}
                title="Every template screams: USE SYSTEM TIME"
                description="Added timestamp-rule to all command frontmatter"
                bullets={[
                  '• CLAUDE.md now has a giant warning at the top',
                  '• Templates updated: feature, ship, now, build, idea',
                  '• No more hardcoded example dates',
                  '• Duration calculations finally accurate',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={MessageSquare}
                title="100% English codebase"
                description="Removed all Spanish from docs and code"
                bullets={[
                  '• All JSDoc comments now in English',
                  '• Template examples converted to English',
                  '• Files fixed: setup.js, postinstall.js, AGENTS.md',
                ]}
              />
            </div>
          </motion.section>
        </DateSection>

        {/* October 5, 2025 - 5 releases */}
        <DateSection id="oct-5-2025" date="October 5, 2025" releaseCount={5}>
          {/* Version 0.8.6 - Command Update Fix */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.8.6" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="fancy"
                contentLayout="horizontal"
                icon={Bug}
                title="Commands weren't updating (we fixed it!)"
                description="Several of you reported this - commands were stuck on old versions even after updating. That's frustrating as hell, so we fixed it."
                bullets={[
                  '• You update prjct, but commands stay old? Yeah, that sucked.',
                  '• Now they ALWAYS update. New features reach you instantly.',
                  '• Thanks for reporting this - your feedback shapes prjct.',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={RefreshCw}
                title="Setup works everywhere now"
                description="CI/CD environments were breaking. Not anymore."
                bullets={[
                  '• Some build systems ignore install scripts - we handle that now',
                  '• It tries during install, but guarantees it on first use',
                  '• Just works. Like it should.',
                ]}
              />
            </div>
          </motion.section>

          {/* Version 0.8.2 - npm-only Installation */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.8.2" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="fancy"
                contentLayout="horizontal"
                icon={Package}
                title="Install got stupid simple"
                description="We killed the multi-step setup. One command. Done."
                bullets={[
                  '• `npm install -g prjct-cli` - that\'s it. Everything else is automatic.',
                  '• Why? Because 3-step installs suck. You told us. We listened.',
                  '• Your slash commands, configs, everything - ready to go.',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={RefreshCw}
                title="Commands auto-sync now"
                description="New features reach you without reinstalling anything"
                bullets={[
                  '• We ship a new command? You get it automatically.',
                  '• We fix a command? You get the fix automatically.',
                  '• Less friction. More building.',
                ]}
              />
            </div>
          </motion.section>

          {/* Version 0.8.1 - Installation & Auto-Update Fixes */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.8.1" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="fancy"
                contentLayout="horizontal"
                icon={Bug}
                title="Install was broken (oops)"
                description="We moved some code around and broke installation. Fixed same day."
                bullets={[
                  '• Cryptic errors during install? Our bad. Paths were wrong.',
                  '• We caught it, fixed it, shipped it.',
                  '• Install works now. Every time.',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={RefreshCw}
                title="Updates show progress now"
                description="You were staring at a blank screen wondering if anything was happening"
                bullets={[
                  '• Now you see what\'s happening when you update',
                  '• Visual feedback. Progress bars. Emojis.',
                  '• You know it\'s working.',
                ]}
              />
            </div>
          </motion.section>

          {/* Version 0.8.0 - Conversational Interface */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.8.0" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="fancy"
                contentLayout="horizontal"
                icon={MessageSquare}
                title="Just talk. No commands to memorize."
                description="The biggest problem? You knew WHAT you wanted but not HOW to use prjct. So we fixed it."
                bullets={[
                  '• Type `p. I want to add auth` - Claude figures out the rest',
                  '• Stuck? Type `p. help` - it adapts to where you are',
                  '• Lost? Type `p. what should I do` - it suggests next steps',
                  '• Works in any language. English, Spanish, whatever.',
                  '• No memorization. Just describe what you want.',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Sparkles}
                title="Website reflects reality"
                description="Our site was selling 'memorize these commands' - but that's not how you use prjct"
                bullets={[
                  '• Rewrote everything to show conversational examples',
                  '• Removed the command reference BS from the hero',
                  '• Shows you talking naturally, not typing commands',
                  '• Because that\'s how it actually works',
                ]}
              />
            </div>
          </motion.section>

          {/* Version 0.7.3 - Testing Documentation */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.7.3" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="fancy"
                contentLayout="horizontal"
                icon={CheckCircle}
                title="Testing documentation"
                description="For contributors and curious devs - here's how we test prjct"
                bullets={[
                  '• 283 tests keeping prjct reliable',
                  '• Full test guide if you want to contribute',
                  '• CI/CD runs tests on every change',
                  '• We show our work - build in public',
                ]}
              />
            </div>
          </motion.section>
        </DateSection>

        {/* October 4, 2025 - 3 releases */}
        <DateSection id="oct-4-2025" date="October 4, 2025" releaseCount={3}>
          {/* Version 0.7.2 - Vercel Deployment Fixes */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.7.2" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Wrench}
                title="Deployment fixes"
                description="Website wasn't deploying. Fixed it."
                bullets={[
                  '• Vercel config was wrong',
                  '• Builds work now',
                  '• Nothing you needed to care about, but we fixed it anyway',
                ]}
              />
            </div>
          </motion.section>

          {/* Version 0.7.1 - Command Status */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.7.1" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={CheckCircle}
                title="Command tracking cleanup"
                description="Making sure we know what works and what doesn't"
                bullets={[
                  '• Updated which commands are actually done vs planned',
                  '• Clearer about what works in Claude vs Terminal',
                  '• Internal housekeeping - boring but necessary',
                ]}
              />
            </div>
          </motion.section>

          {/* Version 0.7.0 - Repository Privacy & Vercel Migration */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.7.0" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="fancy"
                contentLayout="horizontal"
                icon={AlertTriangle}
                title="We closed the code (here's why)"
                description="Hard decision. But it's the honest one."
                bullets={[
                  '• The reality: AI tools + code access = murky legal territory',
                  '• The risk: We don\'t fully understand AI provider terms of service',
                  '• The decision: Close the code until we\'re 100% sure we\'re not putting you at risk',
                  '• FREE forever: Core features stay free. Always.',
                  '• We\'d rather protect you than look open-source-cool',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Shield}
                title="You control everything"
                description="Commands don't run unless you approve them"
                bullets={[
                  '• Every command shows you what it\'ll do first',
                  '• You say yes or no',
                  '• No surprises. No automatic BS.',
                ]}
              />
            </div>
          </motion.section>
        </DateSection>

        {/* October 3, 2025 - 1 release */}
        <DateSection id="oct-3-2025" date="October 3, 2025" releaseCount={1}>
          {/* Version 0.6.0 - Philosophy Transformation */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.6.0" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Sparkles}
                title="We're not a PM tool"
                description="Killed all 'project management' language. This is for builders, not managers."
                bullets={[
                  '• What we realized: You don\'t need a project manager. You need to ship.',
                  '• What we changed: Deleted every "PM", "sprint", "story point" reference',
                  '• New vibe: "Just Ship. No BS" - for solo builders and small teams',
                  '• If you want meetings and ceremonies, use Jira',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Users}
                title="PM agent → Coordinator"
                description="Even our AI agents got the memo"
                bullets={[
                  '• PM agent became "Coordinator" - tracks progress, not people',
                  '• Cut 50% of bloat from agent templates',
                  '• Faster. Leaner. Still helpful.',
                ]}
              />
            </div>
          </motion.section>
        </DateSection>

        {/* October 2, 2025 - 7 releases */}
        <DateSection id="oct-2-2025" date="October 2, 2025" releaseCount={7}>
          {/* Version 0.5.3 - Registry & Documentation Fixes */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.5.3" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Wrench}
                title="Website + docs fixes"
                description="Build errors and wrong instructions"
                bullets={[
                  '• Website wouldn\'t build - module errors',
                  '• Getting started guide had wrong steps',
                  '• Both fixed',
                ]}
              />
            </div>
          </motion.section>

          {/* Version 0.5.2 - Command Registry & Workflow */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.5.2" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={ArrowRightLeft}
                title="Workflow system launched"
                description="AI agents that guide you through features step-by-step"
                bullets={[
                  '• Start a feature, get a workflow automatically',
                  '• Each step assigned to the right specialist agent',
                  '• Missing tools? It asks you to install them',
                  '• /p:done moves you forward. /p:ship finishes it.',
                ]}
              />
            </div>
          </motion.section>

          {/* Version 0.5.1 - Critical Fix */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.5.1" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Wrench}
                title="Broke it, fixed it"
                description="v0.5.0 changes broke the start command"
                bullets={[
                  '• prjct start was crashing',
                  '• Claude-only refactor missed some spots',
                  '• Fixed in hours',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={MessageSquare}
                title="Honest pricing language"
                description="We were saying 'free' when we meant 'uses your Claude subscription'"
                bullets={[
                  '• Changed messaging to be 100% honest',
                  '• No extra costs. Works with your Claude plan.',
                  '• Trust > marketing BS',
                ]}
              />
            </div>
          </motion.section>

          {/* Version 0.5.0 - Claude-Only Decision */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.5.0" />

            {/* Post-Mortem: Why Claude-Only */}
            <div className="mb-8 rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-8">
              <div className="mb-6 flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="mb-3 text-2xl font-bold">Post-Mortem: The Claude-Only Decision</h3>
                  <p className="mb-4 text-lg text-muted-foreground">
                    This version represents a strategic pivot from multi-editor support to 100%
                    Claude focus. Here's the complete story of why we made this decision and what it
                    unlocks.
                  </p>
                </div>
              </div>

              <div className="space-y-6 text-sm">
                <div>
                  <h4 className="mb-3 text-lg font-bold">🎯 The Problem We Discovered</h4>
                  <p className="mb-2 text-muted-foreground">
                    After supporting 4 different AI editors (Claude Code, Cursor, Windsurf, Codex),
                    we realized we were building the <strong>least common denominator</strong>{' '}
                    instead of the <strong>best possible tool</strong>.
                  </p>
                  <ul className="ml-6 space-y-2 text-muted-foreground">
                    <li>
                      • <strong>800+ lines of compatibility code</strong> just to handle different
                      editors
                    </li>
                    <li>
                      • <strong>Features we couldn't build</strong> because they required
                      Claude-specific capabilities
                    </li>
                    <li>
                      • <strong>Testing nightmare</strong> - impossible to validate everything
                      across all platforms
                    </li>
                    <li>
                      • <strong>False promises</strong> - claiming support we couldn't properly test
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="mb-3 text-lg font-bold">
                    💡 The Breakthrough: What Claude Uniquely Enables
                  </h4>
                  <p className="mb-2 text-muted-foreground">
                    By focusing 100% on Claude, we unlocked capabilities that are{' '}
                    <strong>impossible</strong> with multi-platform support:
                  </p>
                  <ul className="ml-6 space-y-2 text-muted-foreground">
                    <li>
                      • <strong>Dynamic AI Agents</strong> - Auto-generated specialists (PM,
                      Frontend, Backend, UX, QA, Security, DevOps, Mobile, Data)
                    </li>
                    <li>
                      • <strong>Native MCP Integration</strong> - Context7, Sequential, Magic,
                      Playwright with zero configuration
                    </li>
                    <li>
                      • <strong>Git Validation</strong> - Last commit as source of truth, prevents
                      fake progress
                    </li>
                    <li>
                      • <strong>p. Trigger System</strong> - Natural language with zero memorization
                      in any language
                    </li>
                    <li>
                      • <strong>50-60% less code</strong> - Simpler = faster features, faster bug
                      fixes, better quality
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="mb-3 text-lg font-bold">📊 The Numbers That Made It Clear</h4>
                  <ul className="ml-6 space-y-2 text-muted-foreground">
                    <li>
                      • <strong>Before:</strong> 800+ lines just for editor compatibility
                    </li>
                    <li>
                      • <strong>After:</strong> 228 lines - focused, tested, reliable
                    </li>
                    <li>
                      • <strong>Feature velocity:</strong> 2-3x faster development
                    </li>
                    <li>
                      • <strong>Testing coverage:</strong> 100% of claimed features actually
                      validated
                    </li>
                    <li>
                      • <strong>Code quality:</strong> Every line serves a purpose, zero cruft
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="mb-3 text-lg font-bold">🤝 The Honest Decision</h4>
                  <p className="mb-2 text-muted-foreground">
                    We chose <strong>honesty over marketing</strong>. Instead of claiming we
                    "support" editors we can't properly test, we're building the absolute best tool
                    for Claude users.
                  </p>
                  <p className="mb-2 text-muted-foreground">
                    <strong>No extra costs or tokens required.</strong> Works with whatever Claude
                    subscription you have (free tier or Pro). No API keys to generate, no additional
                    tokens to buy - just install and use with your existing Claude access.
                  </p>
                  <p className="text-muted-foreground">
                    This isn't about locking users in - it's about delivering the best possible
                    experience within your existing Claude capabilities and limits.
                  </p>
                </div>
              </div>
            </div>

            {/* Major Features */}
            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Sparkles}
                title="p. Trigger - Zero Memorization"
                description="Just talk. Claude understands."
                bullets={[
                  '• "p. I\'m done" works. "p. start building auth" works.',
                  '• Any language. English, Spanish, whatever.',
                  '• Zero API costs - just instructions to Claude',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={MessageSquare}
                title="Copy for real humans"
                description="Killed the dev jargon"
                bullets={[
                  '• "Git validation" became "Checks your actual changes"',
                  '• "MCP Integration" became "AI tools that help you"',
                  '• Speak product, not code',
                ]}
              />
            </div>

            {/* Migration Note */}
            <div className="mt-8 rounded-2xl border-2 border-cat-yellow/30 bg-cat-yellow/10 p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-1 h-6 w-6 flex-shrink-0 text-cat-yellow" />
                <div>
                  <h3 className="mb-2 text-xl font-bold text-cat-yellow">
                    If You Use Cursor, Windsurf, or Codex
                  </h3>
                  <p className="mb-4 text-muted-foreground">
                    <strong className="text-foreground">
                      v0.4.10 is the last version with multi-editor support.
                    </strong>{' '}
                    You can continue using it, but you'll miss all new features.
                  </p>
                  <p className="text-muted-foreground">
                    <strong className="text-foreground">We recommend Claude Code</strong> - works
                    with your existing Claude subscription and gives you the full prjct experience.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Version 0.4.4 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.4.4" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Sparkles}
                title="Install & uninstall automation"
                description="Less manual BS"
                bullets={[
                  '• Install prjct → commands install automatically to all your editors',
                  '• Uninstall prjct → everything cleans up automatically',
                  '• Migrate from old version → happens automatically',
                  '• Zero data loss. Zero manual steps.',
                ]}
              />
            </div>
          </motion.section>

          {/* Version 0.4.3 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.4.3" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={RefreshCw}
                title="Commands auto-update"
                description="npm update now updates your slash commands too"
                bullets={[
                  '• Update prjct → your commands update automatically',
                  '• No reinstall needed',
                  '• Works across all editors',
                ]}
              />
            </div>
          </motion.section>

          {/* Version 0.4.2 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.4.2" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Bug}
                title="Init fix"
                description="Was crashing in non-prjct projects"
                bullets={[
                  '• /p:init was throwing errors in regular projects',
                  '• Fixed',
                ]}
              />
            </div>
          </motion.section>
        </DateSection>

        {/* October 1, 2025 - 4 releases */}
        <DateSection id="oct-1-2025" date="October 1, 2025" releaseCount={4}>
          {/* Version 0.4.1 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.4.1" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Plus}
                title="Update notifications"
                description="You'll know when new versions drop"
                bullets={[
                  '• Checks for updates daily',
                  '• Shows once per session (not annoying)',
                  '• One command to update',
                ]}
              />
            </div>
          </motion.section>

          {/* Version 0.4.0 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.4.0" />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="fancy"
                contentLayout="horizontal"
                icon={CheckCircle}
                title="Workflow system v1"
                description="AI guides you through features step-by-step"
                bullets={[
                  '• Missing test framework? It asks if you want to install one',
                  '• Suggests tools based on your stack (React → Vitest, Angular → Jest)',
                  '• Installs, configures, tracks time - all automatic',
                  '• No more guessing what to do next',
                ]}
              />
            </div>
          </motion.section>

          {/* Versions 0.3.x, 0.2.x - Technical fixes */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <div className="rounded-lg bg-muted/10 p-6">
              <p className="text-sm text-muted-foreground">
                <strong>v0.3.x → v0.2.0:</strong> Installation fixes, dependency updates, path resolutions, and other technical improvements. Nothing you needed to care about.
              </p>
            </div>
          </motion.section>

          {/* Version 0.1.0 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.1.0" />

            <div className="mb-6 space-y-6">
              <div className="rounded-2xl bg-muted/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Initial Release</h3>
                    <p className="mb-3 text-muted-foreground">
                      First public release of prjct-cli - AI-integrated developer momentum tool
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• AI-integrated developer momentum tool</li>
                      <li>• Support for Claude Code, OpenAI Codex, and Terminal</li>
                      <li>• Core commands: init, now, done, ship, recap, and more</li>
                      <li>• MCP integration for AI assistants</li>
                      <li>• Automatic environment detection</li>
                      <li>
                        • Project structure in <code className="text-cat-mauve">.prjct/</code>{' '}
                        directory
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        </DateSection>

        {/* Stay Updated */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-8 text-center"
        >
          <h3 className="mb-2 text-2xl font-bold">Stay Updated</h3>
          <p className="mb-6 text-muted-foreground">
            Follow our GitHub repository for the latest updates and releases.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://github.com/jlopezlira/prjct-cli/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              View All Releases
            </a>
            <a
              href="https://github.com/jlopezlira/prjct-cli"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-muted/50 px-6 py-3 font-medium transition-colors hover:bg-muted"
            >
              Star on GitHub
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
