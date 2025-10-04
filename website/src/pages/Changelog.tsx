import { motion } from 'framer-motion'
import {
  GitBranch,
  AlertTriangle,
  Plus,
  Wrench,
  Trash2,
  Shield,
  Users,
  Database,
  CheckCircle,
  Bug,
  RefreshCw,
  Package,
  Sparkles,
  ArrowRightLeft,
  MessageSquare,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { VersionHeader } from '@/components/changelog/VersionHeader'
import { FeatureCard } from '@/components/ui/FeatureCard'
import { TechnicalDetails } from '@/components/changelog/TechnicalDetails'
import { DateSection } from '@/components/changelog/DateSection'
import { TimelineNav } from '@/components/changelog/TimelineNav'

export const Changelog = () => {
  // Timeline navigation items
  const timelineItems = [
    { id: 'oct-4-2025', date: 'Oct 4, 2025', releaseCount: 1 },
    { id: 'oct-3-2025', date: 'Oct 3, 2025', releaseCount: 1 },
    { id: 'oct-2-2025', date: 'Oct 2, 2025', releaseCount: 7 },
    { id: 'oct-1-2025', date: 'Oct 1, 2025', releaseCount: 4 },
    { id: 'sep-30-2025', date: 'Sep 30, 2025', releaseCount: 3 },
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

        {/* October 4, 2025 - 1 release */}
        <DateSection id="oct-4-2025" date="October 4, 2025" releaseCount={1}>
          {/* BREAKING CHANGE - No Longer Open Source */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.7.0" isLatest />

            <div className="mb-6 space-y-6">
              <FeatureCard
                variant="fancy"
                contentLayout="horizontal"
                icon={AlertTriangle}
                title="No Longer Open Source"
                description="prjct is now proprietary software. FREE tier remains available forever."
                bullets={[
                  '• Repository made private due to AI agent privacy concerns and terms of use compliance',
                  '• **FREE tier**: Available to all users indefinitely with full core features',
                  '• **PRO tier**: Optional paid upgrade with additional features (coming soon)',
                  '• Migration to Vercel for better deployment and hosting',
                  '• Contact: jlopezlira@gmail.com or jlopezlira.dev',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Shield}
                title="User Safety Improvements"
                description="Enhanced user control and transparency"
                bullets={[
                  '• **Plan Mode**: All commands now require explicit user confirmation before execution',
                  '• No automatic actions without user approval',
                  '• Clear presentation of what will be done before doing it',
                  '• Protects users from unintended changes',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Package}
                title="Website Updates"
                description="Removed all GitHub repository links and updated contact information"
                bullets={[
                  '• Removed all GitHub repository links from website',
                  '• Added contact section with email and website',
                  '• Updated Terms of Use with proprietary license',
                  '• Updated Privacy Policy for Vercel hosting',
                  '• Removed open source transparency section',
                ]}
              />
            </div>

            <TechnicalDetails
              details={[
                <div key="why">
                  <strong>Why this change?</strong>
                  <p className="mt-2 text-sm">
                    We believe in building honest products. As an agentic AI tool that processes your code and interacts with AI services, we want to be transparent: we're not certain about potential conflicts with third-party terms of service, especially AI provider policies.
                  </p>
                  <p className="mt-2 text-sm">
                    Rather than risk affecting our users or violating terms we don't fully understand, we've chosen to make the codebase private. This lets us develop responsibly while we clarify these concerns.
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    The FREE tier remains available to everyone, forever. We're committed to transparency and doing right by our users.
                  </p>
                </div>,
              ]}
            />
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
                title="Philosophy Transformation"
                description="Complete rebrand from PM tool to developer momentum tool for indie hackers and solo builders"
                bullets={[
                  '• Eliminated ALL "project management" language from entire codebase',
                  '• New messaging: "Just Ship. No BS" for creators, not managers',
                  '• Updated CLAUDE.md: "developer momentum tool for solo builders, indie hackers, and small teams (2-5 people)"',
                  '• Rewrote AGENTS.md (165→143 lines): "NOT project management. NO sprints, story points, ceremonies, or meetings"',
                  '• Website transformation: Hero, Features, ClaudeSuperpowers, Privacy - all copy now creator-focused',
                  '• Zero "PM" or "project management" references (except as critique of traditional tools)',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Users}
                title="Agent System Redesign"
                description='Renamed PM agent → Coordinator ("Progress Coordinator" for shipping features, not managing people)'
                bullets={[
                  '• Renamed pm.template.md → coordinator.template.md (85→35 lines, 58% reduction)',
                  '• Role change: "Project Manager" → "Progress Coordinator"',
                  '• Focus: Task breakdown/planning → Progress tracking & shipping features',
                  '• Updated core/agent-generator.js baseAgents: "pm" → "coordinator"',
                  '• Philosophy: "SHIP features and track progress, not manage people or run meetings"',
                  '• ⚠️ Breaking: Existing projects need /p:sync to regenerate agents',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Package}
                title="Template Optimization"
                description="46.5% reduction in agent template verbosity (540 → 289 lines total)"
                bullets={[
                  '• Strategy: Instructions + placeholders instead of verbose pre-filled content',
                  '• scribe.template.md: 96→30 lines (69% reduction - biggest!)',
                  '• coordinator.template.md: 85→35 lines (58%)',
                  '• qa.template.md: 55→28 lines (49%)',
                  '• fe, be, ux, devops, mobile, data, security: All optimized to 28 lines',
                  '• Benefit: Agents load faster, consume fewer tokens, maintain clarity',
                ]}
              />
            </div>

            <TechnicalDetails
              details={[
                'Breaking Change: Agent naming (pm → coordinator) requires /p:sync for existing projects',
                'Template Reduction: 540 → 289 lines (46.5% overall)',
                'Website: All PM references removed - creator-focused messaging throughout',
                'Philosophy: Complete transformation to "Just Ship. No BS" for indie hackers',
                'Documentation: CLAUDE.md, README.md, AGENTS.md all updated with new messaging',
              ]}
            />
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
                title="Website Build Fixes"
                description="Fixed ES module compatibility for browser - command registry now loads correctly"
                bullets={[
                  '• Created ES module version at website/src/data/command-registry.ts',
                  '• Converted module.exports to export default for browser compatibility',
                  '• Replaced require() with ES6 import in Components.tsx',
                  '• Added proper TypeScript type annotations',
                  '• Removed all TypeScript any types for better type safety',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={CheckCircle}
                title="Documentation Accuracy"
                description="Updated Getting Started guide with correct installation flow"
                bullets={[
                  '• Step 1: npm install -g prjct-cli (global installation)',
                  '• Step 2: prjct start (setup Claude Code integration)',
                  '• Step 3: /p:init (initialize project)',
                  '• Step 4: /p:now (start working)',
                  '• Fixed missing npm install and prjct start steps',
                ]}
              />
            </div>

            <TechnicalDetails
              details={[
                'ES Module Conversion: CommonJS → ES6 for browser compatibility',
                'TypeScript Types: Added interfaces for Command, CategoryInfo, CommandUsage',
                'Type Safety: Removed all implicit any types',
                'Build Success: Website compiles without errors',
                'Documentation: Updated Getting Started section with complete flow',
              ]}
            />
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
                icon={Database}
                title="Command Registry System"
                description="Single source of truth for all prjct commands (core/command-registry.js)"
                bullets={[
                  '• All 25 commands defined in single location with metadata',
                  '• Category system (work, planning, design, quality, progress, help, git, testing, setup)',
                  '• Implementation status tracking (19 implemented, 6 planned)',
                  '• Platform availability (Claude Code vs Terminal)',
                  '• Template file mapping',
                  '• Helper functions for filtering, querying, and statistics',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={ArrowRightLeft}
                title="Complete Workflow System Integration"
                description="Automated task orchestration with AI workflow agents"
                bullets={[
                  '• Auto-initialization: Features activate automatically when using /p:feature "implement [feature]"',
                  '• Task Classification: Automatic detection of workflow type (ui, api, bug, refactor, feature)',
                  '• Capability Detection: Detects design system, test framework, docs system',
                  '• Interactive Prompts: Asks user to choose tools when capabilities are missing',
                  '• Step Progression: Each /p:done advances to next workflow step',
                  '• Agent Assignment: Each step assigned to appropriate specialist agent',
                  '• Workflow Status: /p:ship automates complete workflow (lint/test/docs/version/changelog/commit/push)',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={CheckCircle}
                title="/p:sync Command Implementation"
                description="Sync project state and update workflow agents"
                bullets={[
                  '• Re-analyzes project with /p:analyze (silent mode)',
                  '• Generates/updates workflow agents in global project directory',
                  '• Creates base agents: pm, ux, fe, be, qa, scribe',
                  '• Creates conditional agents: security, devops, mobile, data (based on stack)',
                  '• Logs sync action to memory/context.jsonl',
                  '• Shows summary and agents path',
                ]}
              />
            </div>

            <TechnicalDetails
              details={[
                'Command Registry: 430 lines, complete command metadata in core/command-registry.js',
                'Workflow Storage: ~/.prjct-cli/projects/{id}/workflow/state.json',
                'Agents Storage: ~/.prjct-cli/projects/{id}/agents/',
                '5 workflow types with specialized step sequences',
                '10 agent types: pm, ux, fe, be, qa, scribe, security, devops, mobile, data',
                'Automated validation: scripts/validate-commands.js',
              ]}
            />
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
                title="Critical: prjct start Command Error"
                description="Fixed 'commandInstaller.detectEditors is not a function' error"
                bullets={[
                  '• Root Cause: v0.5.0 refactored command-installer.js to Claude-only architecture',
                  '• Refactored start() function to use detectClaude() instead of detectEditors()',
                  '• Replaced interactiveInstall() with installCommands()',
                  '• Removed multi-editor logic (Cursor, Windsurf references)',
                  '• Updated messaging to be Claude-only with download link',
                  '• Simplified setup() function with installation status checking',
                  '• Added --force flag support for reinstallation',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={MessageSquare}
                title="Corrected Claude Subscription Messaging"
                description="Clarified honest pricing throughout"
                bullets={[
                  '• Changed "Claude Code is 100% free" → "Works with whatever Claude subscription you have"',
                  '• Added clarity: "No extra costs or tokens required"',
                  '• Emphasized "no extra setup", "no token management", "no API keys to configure"',
                  '• Updated README.md, website components, and FAQ sections',
                  '• Being honest about costs builds trust',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={CheckCircle}
                title="Fixed TypeScript Errors"
                description="Removed unused imports across website components"
                bullets={[
                  '• Fixed website/src/pages/Changelog.tsx: Added missing MessageSquare import',
                  '• Fixed website/src/components/Features.tsx: Removed unused Cpu import',
                  '• Fixed website/src/pages/Commands.tsx: Removed unused Cpu, Wind imports',
                  '• Website now compiles without TypeScript errors',
                ]}
              />
            </div>

            <TechnicalDetails
              details={[
                'Command Installation: Successfully installs all 21 /p:* commands to ~/.claude/commands/p/',
                'Editor Installation: Removed multi-editor references',
                'Subscription Messaging: Accurate throughout all documentation',
                'TypeScript Compilation: Zero errors',
              ]}
            />
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
                title="p. Trigger - Zero Memorization Interface"
                description="Natural language with p. prefix - works in any language, zero commands to memorize"
                bullets={[
                  '• Simple prefix: "p. I\'m done" → /p:done | "p. start building auth" → /p:now',
                  '• Works in English, Spanish, German, French, any language',
                  "• Intent detection powered by Claude's language understanding",
                  '• Auto-validates project context before execution',
                  '• Implemented via CLAUDE.md instructions - zero SDK, zero API costs',
                  '• Friendly error messages when not in prjct project',
                  '• Complete docs in docs/p-trigger.md',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={MessageSquare}
                title="Copy Simplification for Creators"
                description="Made everything stupidly simple to understand for non-technical creators"
                bullets={[
                  '• Updated README.md: "Ship fast, track progress, stay focused" mood',
                  '• Changed "indie hackers" → "solo creators and founders"',
                  '• Simplified jargon: "Git validation" → "Checks your actual code changes"',
                  '• Simplified jargon: "MCP Integration" → "AI tools that help you code"',
                  '• Simplified jargon: "Dynamic AI Agents" → "Smart AI helpers"',
                  '• Updated website examples: Real product language',
                  '• "implement user authentication" → "build login feature"',
                  '• "JWT token not validating" → "login not working"',
                  '• Added explanatory comments to all code utilities',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={CheckCircle}
                title="Complete Website Alignment"
                description="ALL website components now show p. trigger correctly - zero confusion"
                bullets={[
                  '• Features.tsx: "p. I\'m done" → /p:done | "p. start building auth" → /p:now',
                  '• ClaudeSuperpowers.tsx: "p. Trigger - Zero Memorization"',
                  '• Commands.tsx: "p. I want to start building the login page"',
                  '• QuickStart.tsx: "p. I\'m done" when finished',
                  '• Interactive examples show p. trigger as primary interface',
                  '• Consistent messaging across all pages and components',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={ArrowRightLeft}
                title="Windsurf Extension Preview"
                description="Roadmap section for future Windsurf VS Code extension to measure market traction"
                bullets={[
                  '• Complete preview section with timeline (Oct 2025 - Feb 2026)',
                  '• 4 key features: Real-time Metrics, Focus Mode, Velocity Tracking, Smart Notifications',
                  '• Interactive mockup showing drag & drop roadmap',
                  '• Early access waitlist via GitHub issues',
                  '• Progress tracking: 10% complete (validation phase)',
                  '• Badge and CTA in Hero with scroll-to-section animation',
                ]}
              />
            </div>

            <TechnicalDetails
              details={[
                'Breaking Change: Removed support for Cursor, Windsurf, and Codex - Claude Code only',
                'Code Reduction: 800+ lines → 228 lines in command installer (-72% code)',
                'Natural Language: p. trigger system with semantic intent detection',
                'Copy Simplification: All text optimized for creators and small teams',
                'Website Alignment: 100% consistent p. trigger examples across all pages',
                'Windsurf Preview: Future extension roadmap section for market validation',
                'Feature Velocity: 2-3x faster development with focused architecture',
                'Testing Coverage: 100% validation of all claimed features',
                'MCP Integration: Context7, Sequential, Magic, Playwright enabled by default',
              ]}
            />

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
                    You can continue using it:
                  </p>
                  <pre className="mb-4 rounded-lg bg-black p-4 text-sm">
                    <code className="text-cat-teal">npm install -g prjct-cli@0.4.10</code>
                  </pre>
                  <p className="mb-2 text-muted-foreground">
                    However, you'll miss all new features (agents, MCP, git validation, p. trigger,
                    natural language).
                  </p>
                  <p className="text-muted-foreground">
                    <strong className="text-foreground">We recommend Claude Code</strong> - works
                    with your existing Claude subscription (free tier or Pro) and gives you the full
                    prjct experience.
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
                title="Auto-Installation on First Install"
                description="Zero-configuration setup - detects and installs to all AI editors automatically"
                bullets={[
                  '• Auto-detects Claude Code, Cursor, Windsurf, and Codex',
                  '• Installs commands to all detected editors automatically',
                  '• Creates tracking configuration from the start',
                  '• No manual `prjct install` needed after global npm install',
                  '• Graceful handling when no editors are detected',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Trash2}
                title="Automatic Cleanup on Uninstall"
                description="Clean uninstallation removes all traces"
                bullets={[
                  '• New scripts/preuninstall.js runs before uninstall',
                  '• Removes commands from ~/.claude/, ~/.cursor/, ~/.windsurf/',
                  '• Deletes tracking configuration',
                  '• Prevents orphaned commands when package is uninstalled',
                  '• Added uninstallFromEditor() and uninstallFromAll() methods',
                  "• Clean exit even if cleanup fails (doesn't block uninstall)",
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={ArrowRightLeft}
                title="Automatic Data Migration"
                description="Seamless upgrade from v0.1.0 to v0.4.4 - zero data loss"
                bullets={[
                  '• Automatically detects legacy .prjct/ projects during update',
                  '• Migrates to new global architecture ~/.prjct-cli/projects/{id}/',
                  '• Scans common project directories (Projects, Documents, Developer, Code)',
                  '• Preserves all data: core, progress, planning, analysis, memory layers',
                  '• Cleans legacy directories while keeping config for compatibility',
                  '• Uses battle-tested core/migrator.js system',
                  '• No user intervention required - happens automatically on npm update',
                ]}
              />
            </div>

            <TechnicalDetails
              details={[
                'Post-Install Hook: Auto-detects and installs to all AI editors on first install',
                'Pre-Uninstall Hook: Removes slash commands and tracking config before uninstall',
                'Migration System: Automatically detects and migrates legacy v0.1.0 projects',
                'Improved Tracking: installToSelected() now always saves editor config',
                'Version Detection: Compares current with last installed version',
                'Force Update: Automatically updates commands when version changes',
                'Data Preservation: Zero data loss during migration, all layers preserved',
              ]}
            />
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
                title="Automatic Editor Command Updates"
                description="Commands auto-update when npm package is updated"
                bullets={[
                  '• New core/editors-config.js tracks installed editors',
                  '• Stores selections in ~/.prjct-cli/config/installed-editors.json',
                  '• Post-install hook auto-updates after npm update -g prjct-cli',
                  '• Ensures version consistency across all editors (Claude, Cursor, Windsurf, Codex)',
                  '• No manual reinstallation needed - updates happen automatically',
                  "• Respects user's original editor choices from initial setup",
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Package}
                title="GitHub Packages Support"
                description="Dual registry publication for better reliability"
                bullets={[
                  '• Package published to both npm and GitHub Packages automatically',
                  '• GitHub Actions workflow updated for parallel publication',
                  '• Comprehensive docs in docs/GITHUB_PACKAGES.md',
                  '• Includes .npmrc.example for easy configuration',
                  '• Provides fallback option if npm registry is unavailable',
                  '• Free hosting for public repositories with automatic authentication',
                ]}
              />
            </div>

            <TechnicalDetails
              details={[
                'Editor Tracking: Configuration saved after all successful installations',
                'Version Detection: Compares current with last installed version',
                'Force Update: Automatically updates commands when version changes',
                'Parallel Publication: npm and GitHub Packages jobs run simultaneously',
              ]}
            />
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
                title="Analyzer Compatibility Fix"
                description="Fixed ENOENT error when running /p:init in non-prjct projects"
                bullets={[
                  '• Added validation to check if bin/prjct exists before reading',
                  '• Analyzer now works correctly in any project type (React, Vue, etc.)',
                  '• No longer throws "no such file or directory" error',
                  '• Maintains full functionality for prjct-cli development projects',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Wrench}
                title="Website Build Improvements"
                description="Improved build script and component imports"
                bullets={[
                  '• Fixed Badge component import casing (badge → Badge)',
                  '• Removed obsolete install.sh and setup.sh copying from build script',
                  '• Cleaner and faster website builds',
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
                title="Automatic Update Detection"
                description="Built-in update checker that notifies users when new versions are available"
                bullets={[
                  '• Checks npm registry every 24 hours for new versions',
                  '• Non-blocking background check during command execution',
                  '• Formatted notification with update command',
                  '• Shows only once per session to avoid notification spam',
                  '• Respects 24-hour cache to minimize npm registry requests',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Shield}
                title="Automated npm Publication"
                description="GitHub Actions workflow for automatic npm publishing with OIDC security"
                bullets={[
                  '• Triggered on version tags (v*)',
                  '• Automatic version verification against package.json',
                  '• Provenance publishing with npm attestation',
                  '• OIDC Trusted Publisher authentication (no tokens)',
                  '• Post-publication verification',
                  '• Publication summary in GitHub Actions',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Wrench}
                title="Simplified Installation"
                description="npm is now the primary and recommended installation method"
                bullets={[
                  '• Single installation method: npm install -g prjct-cli',
                  '• Removed Homebrew and Bun installation scripts',
                  '• Cleaner package with optimized file inclusion',
                  '• Reduced package size: 104.6 KB (71 files)',
                ]}
              />

              <FeatureCard
                variant="simple"
                contentLayout="horizontal"
                icon={Database}
                title="Package Structure Fixes"
                bullets={[
                  '• Added files field to control package contents',
                  '• Created .npmignore for development file exclusion',
                  '• Proper global data directory separation (~/.prjct-cli/ for data only)',
                  '• Fixed CI/CD tests to verify CLI functionality instead of individual modules',
                ]}
              />
            </div>

            <TechnicalDetails
              details={[
                '• Update Checker: core/update-checker.js with semantic version comparison',
                '• Cache Management: Update checks cached for 24 hours in ~/.prjct-cli/config/update-cache.json',
                '• Architecture: Clean separation between npm installation and user data',
                '• GitHub Actions: .github/workflows/publish-npm.yml for automated publication',
              ]}
            />
          </motion.section>

          {/* Version 0.4.0 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.4.0" />

            {/* Interactive Workflow System */}
            <div className="mb-6 space-y-6">
              <div className="relative isolate overflow-visible">
                <div className="fancy-border pointer-events-none"></div>
                <div className="relative z-10 rounded-2xl border border-border bg-black p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-2 text-xl font-bold">Interactive Workflow System</h3>
                      <p className="mb-3 text-muted-foreground">
                        Intelligent agent workflows with user-guided capability installation.
                        Workflows detect missing capabilities and prompt users for decisions instead
                        of auto-skipping steps.
                      </p>

                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>
                          • <strong>Adaptive Workflows</strong>: Detect missing capabilities and
                          prompt user for install/skip/continue/pause decisions
                        </li>
                        <li>
                          • <strong>Smart Recommendations</strong>: Stack-aware tool suggestions
                          (React → Vitest, Vue → Vitest, Angular → Jest)
                        </li>
                        <li>
                          • <strong>Installation Tracking</strong>: Every tool installation becomes
                          a visible, tracked workflow task with duration
                        </li>
                        <li>
                          • <strong>Interactive Prompts</strong>: Never auto-skips steps - always
                          asks user for decisions
                        </li>
                        <li>
                          • <strong>Capability Detection</strong>: Automatically detects design
                          systems, test frameworks, and documentation tools
                        </li>
                        <li>
                          • <strong>Auto-Configuration</strong>: Installed tools are automatically
                          configured with framework-specific settings
                        </li>
                        <li>
                          • <strong>Workflow Types</strong>: UI, API, Bug Fix, Refactor, and Feature
                          workflows with specialized agent assignments
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* New Core Modules */}
              <div className="rounded-2xl bg-muted/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">New Core Modules</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        • <code className="text-cat-mauve">core/workflow-engine.js</code>:
                        Orchestrates adaptive workflows with step management
                      </li>
                      <li>
                        • <code className="text-cat-mauve">core/workflow-rules.js</code>: Defines
                        workflow pipelines by task type
                      </li>
                      <li>
                        • <code className="text-cat-mauve">core/workflow-prompts.js</code>:
                        Interactive prompting engine with stack detection
                      </li>
                      <li>
                        • <code className="text-cat-mauve">core/capability-installer.js</code>:
                        Handles tool installation, configuration, and verification
                      </li>
                      <li>
                        • <code className="text-cat-mauve">core/project-capabilities.js</code>:
                        Detects existing project capabilities (design/test/docs)
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Enhanced Commands */}
              <div className="rounded-2xl bg-muted/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Wrench className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Enhanced Commands</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        • <code className="text-cat-mauve">workflowRespond(choice)</code>: Handle
                        user responses to workflow prompts
                      </li>
                      <li>
                        • Enhanced <code className="text-cat-mauve">done()</code>: Checks for
                        prompts, advances workflows intelligently
                      </li>
                      <li>
                        • Enhanced <code className="text-cat-mauve">idea()</code>: Auto-initializes
                        workflows for actionable tasks
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Details */}
            <details className="mt-8 cursor-pointer rounded-2xl bg-muted/10 p-6">
              <summary className="mb-4 text-lg font-semibold">Technical Details</summary>
              <div className="space-y-6 text-sm">
                <div>
                  <h4 className="mb-2 font-bold text-cat-green">Stack Detection</h4>
                  <ul className="ml-6 space-y-1 text-muted-foreground">
                    <li>
                      • Identifies React/Vue/Angular, TypeScript, bundler (Vite/Webpack/esbuild)
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="mb-2 font-bold text-cat-green">Tool Recommendations</h4>
                  <ul className="ml-6 space-y-1 text-muted-foreground">
                    <li>• React + TS → Vitest + Testing Library</li>
                    <li>• Vue → Vitest + @vue/test-utils</li>
                    <li>• Angular → Jest + @types/jest</li>
                  </ul>
                </div>

                <div>
                  <h4 className="mb-2 font-bold text-cat-green">Auto-Configuration</h4>
                  <ul className="ml-6 space-y-1 text-muted-foreground">
                    <li>• Creates config files (vitest.config.js, jest.config.js, jsdoc.json)</li>
                    <li>• Updates package.json scripts</li>
                    <li>• Verifies installation success</li>
                  </ul>
                </div>

                <div>
                  <h4 className="mb-2 font-bold text-cat-yellow">Workflow Behavior Changes</h4>
                  <ul className="ml-6 space-y-1 text-muted-foreground">
                    <li>• Before: Missing capability → auto-skip step</li>
                    <li>
                      • After: Missing capability → prompt user → track installation → continue
                    </li>
                    <li>
                      • Duration tracking: Installation tasks show completion time (e.g., "1.2 min")
                    </li>
                    <li>• All workflow steps tracked with status, duration, and metadata</li>
                  </ul>
                </div>
              </div>
            </details>
          </motion.section>

          {/* Version 0.3.2 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.3.2" />

            {/* Interactive Installation Compatibility */}
            <div className="mb-6 space-y-6">
              <div className="rounded-2xl bg-muted/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-cat-green/20">
                    <Wrench className="h-5 w-5 text-cat-green" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">
                      Interactive Installation Compatibility
                    </h3>
                    <p className="mb-3 text-muted-foreground">
                      Fixed interactive editor selection failing due to inquirer library ESM
                      compatibility issues.
                    </p>

                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        • Replaced inquirer v12 with prompts v2.4.2 for better CommonJS
                        compatibility
                      </li>
                      <li>
                        • Fixed "inquirer.prompt is not a function" and "createPromptModule is not a
                        function" errors
                      </li>
                      <li>
                        • inquirer v12 required complex ESM dynamic imports that were causing
                        runtime failures
                      </li>
                      <li>• prompts provides simpler API with native CommonJS support</li>
                      <li>• Reduced package count from 68 to 40 dependencies</li>
                      <li>• Interactive UI now works reliably across all Node.js versions</li>
                      <li>
                        • Updated{' '}
                        <code className="text-cat-mauve">scripts/interactive-install.js</code> and{' '}
                        <code className="text-cat-mauve">core/command-installer.js</code>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Version 0.3.1 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.3.1" />

            {/* Installation Path Fix */}
            <div className="mb-6 space-y-6">
              <div className="rounded-2xl bg-muted/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-cat-green/20">
                    <Wrench className="h-5 w-5 text-cat-green" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Installation Path Resolution Fix</h3>
                    <p className="mb-3 text-muted-foreground">
                      Fixed critical installation error that prevented users from installing
                      prjct-cli via curl.
                    </p>

                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        • Fixed "setup.sh: No such file or directory" error during installation (
                        <a
                          href="https://github.com/jlopezlira/prjct-cli/issues/11"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          #11
                        </a>
                        )
                      </li>
                      <li>
                        • Corrected path resolution in{' '}
                        <code className="text-cat-mauve">docs/install.sh</code>,{' '}
                        <code className="text-cat-mauve">scripts/install.sh</code>, and{' '}
                        <code className="text-cat-mauve">scripts/setup.sh</code>
                      </li>
                      <li>
                        • Added verification tests in{' '}
                        <code className="text-cat-mauve">tests/verify-install-paths.sh</code>
                      </li>
                      <li>
                        • Added comprehensive documentation in{' '}
                        <code className="text-cat-mauve">tests/INSTALL_PATH_FIX.md</code>
                      </li>
                      <li>
                        • Thanks to{' '}
                        <a
                          href="https://github.com/danrocha"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          @danrocha
                        </a>{' '}
                        for reporting the issue
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        </DateSection>

        {/* September 30, 2025 - 3 releases */}
        <DateSection id="sep-30-2025" date="September 30, 2025" releaseCount={3}>
          {/* Version 0.3.0 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.3.0" />

            {/* Intelligent Codebase Analysis */}
            <div className="mb-6 space-y-6">
              <div className="rounded-2xl bg-muted/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <CheckCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Intelligent Codebase Analysis & Sync</h3>
                    <p className="mb-3 text-muted-foreground">
                      Auto-detect implemented features and sync project state. Perfect for teams
                      working without cloud storage.
                    </p>

                    <div className="mb-4 space-y-3">
                      <div className="rounded-lg border border-border bg-background/50 p-3">
                        <code className="text-sm text-cat-mauve">/p:analyze</code>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Analyze codebase and detect implemented commands/features
                        </p>
                      </div>

                      <div className="rounded-lg border border-border bg-background/50 p-3">
                        <code className="text-sm text-cat-mauve">/p:analyze --sync</code>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Automatically update .prjct/ files with real implementation state
                        </p>
                      </div>
                    </div>

                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        • Auto-execution during <code className="text-cat-mauve">/p:init</code> when
                        cloning repos with existing code
                      </li>
                      <li>• Detects implemented commands by scanning source files</li>
                      <li>
                        • Extracts completed features from git history, dependencies, and directory
                        structure
                      </li>
                      <li>
                        • Automatically updates <code className="text-cat-mauve">next.md</code> by
                        marking completed tasks
                      </li>
                      <li>
                        • Adds detected features to{' '}
                        <code className="text-cat-mauve">shipped.md</code>
                      </li>
                      <li>
                        • Generates detailed analysis reports in{' '}
                        <code className="text-cat-mauve">analysis/repo-summary.md</code>
                      </li>
                      <li>• Prevents duplicate work across team members</li>
                      <li>• Real project status visibility without cloud sync</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Interactive Editor Selection */}
              <div className="rounded-2xl bg-muted/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Interactive Editor Selection</h3>
                    <p className="mb-3 text-muted-foreground">
                      Choose which AI editors to install commands to via interactive checkboxes
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        • Interactive checkbox UI during{' '}
                        <code className="text-cat-mauve">prjct install</code> and{' '}
                        <code className="text-cat-mauve">prjct init</code>
                      </li>
                      <li>
                        • Detects all installed editors (Claude Code, Cursor, Codex, Windsurf)
                      </li>
                      <li>• Shows installation paths for each detected editor</li>
                      <li>• Allows users to select only the editors they use</li>
                      <li>
                        • <code className="text-cat-mauve">--no-interactive</code> flag to install
                        to all detected editors without prompts
                      </li>
                      <li>• Optimizes installation by avoiding unnecessary editor installations</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Updated Branding */}
              <div className="rounded-2xl bg-muted/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Wrench className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Updated Branding</h3>
                    <p className="mb-3 text-muted-foreground">
                      New header design with kaomoji (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Refreshed README.md header with fun, friendly design</li>
                      <li>• Updated installer (scripts/install.sh) to match new branding</li>
                      <li>
                        • Consistent visual identity across documentation and installation
                        experience
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Version 0.2.1 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.2.1" />

            {/* Key Features */}
            <div className="space-y-6">
              {/* Multi-Editor Support */}
              <div className="rounded-2xl bg-muted/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <CheckCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Multi-Editor Command Installation</h3>
                    <p className="mb-3 text-muted-foreground">
                      Automatic slash command deployment across AI editors with seamless
                      synchronization.
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        • <code className="text-cat-mauve">prjct install</code> command for all
                        detected editors
                      </li>
                      <li>• Support for Claude Code, Cursor AI, and Codeium</li>
                      <li>
                        • Template-based command system in{' '}
                        <code className="text-cat-mauve">~/.prjct-cli/templates/</code>
                      </li>
                      <li>
                        • Automatic installation during{' '}
                        <code className="text-cat-mauve">prjct init</code>
                      </li>
                      <li>• Cross-editor data synchronization through global architecture</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Global Migration */}
              <div className="rounded-2xl bg-muted/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Global Migration System</h3>
                    <p className="mb-3 text-muted-foreground">
                      Migrate all legacy projects on your machine with a single command.
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        • <code className="text-cat-mauve">prjct migrate-all</code> finds and
                        migrates all legacy projects
                      </li>
                      <li>
                        • Scans common directories:{' '}
                        <code className="text-cat-mauve">~/Projects</code>,{' '}
                        <code className="text-cat-mauve">~/Documents</code>, etc.
                      </li>
                      <li>
                        • Optional <code className="text-cat-mauve">--deep-scan</code> for entire
                        home directory
                      </li>
                      <li>
                        • <code className="text-cat-mauve">--dry-run</code> to preview changes
                      </li>
                      <li>
                        • <code className="text-cat-mauve">--remove-legacy</code> to clean up after
                        migration
                      </li>
                      <li>• Progress tracking and comprehensive reports</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Repository Reorganization */}
              <div className="rounded-2xl bg-muted/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Wrench className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Repository Structure Reorganization</h3>
                    <p className="mb-3 text-muted-foreground">
                      Cleaner project structure with better organization and clarity.
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        • Source code moved to <code className="text-cat-mauve">src/</code>{' '}
                        directory
                      </li>
                      <li>
                        • Scripts organized in <code className="text-cat-mauve">scripts/</code>
                      </li>
                      <li>
                        • Configuration in <code className="text-cat-mauve">.config/</code>
                      </li>
                      <li>
                        • Renamed <code className="text-cat-mauve">lp/</code> to{' '}
                        <code className="text-cat-mauve">website/</code> for clarity
                      </li>
                      <li>
                        • Added <code className="text-cat-mauve">templates/commands/</code> for
                        command distribution
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Version 0.2.0 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <VersionHeader version="v0.2.0" />

            {/* Breaking Changes Alert */}
            <div className="mb-8 rounded-2xl border-2 border-cat-red/30 bg-cat-red/10 p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-1 h-6 w-6 flex-shrink-0 text-cat-red" />
                <div>
                  <h3 className="mb-2 text-xl font-bold text-cat-red">Data Relocation Required</h3>
                  <p className="mb-4 text-muted-foreground">
                    <strong className="text-foreground">Important:</strong> This is a DATA
                    RELOCATION, not deletion. ALL your data is preserved and moved to a better
                    location.
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-cat-green" />
                      <span>100% data preservation - every file, log, and timestamp</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-cat-green" />
                      <span>Automatic migration with validation</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-cat-green" />
                      <span>Reversible process (.prjct/ kept as backup by default)</span>
                    </li>
                  </ul>
                  <Link
                    to="/docs/migration"
                    className="mt-4 inline-flex items-center gap-2 font-medium text-cat-red hover:underline"
                  >
                    Read Migration Guide →
                  </Link>
                </div>
              </div>
            </div>

            {/* Key Changes */}
            <div className="space-y-6">
              {/* Collaboration Feature */}
              <div className="rounded-2xl bg-muted/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Collaboration-Ready Architecture</h3>
                    <p className="mb-3 text-muted-foreground">
                      Designed for teams WITHOUT exposing personal data. Work together while keeping
                      your velocity and notes private.
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        • <code className="text-cat-mauve">.prjct/prjct.config.json</code> in
                        project (safe to commit)
                      </li>
                      <li>
                        • Personal logs stay in{' '}
                        <code className="text-cat-mauve">~/.prjct-cli/</code> (never committed)
                      </li>
                      <li>• Author tracking enables future collaboration features</li>
                      <li>• Perfect for open source, remote teams, consulting</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Data Storage */}
              <div className="rounded-2xl bg-muted/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Global Data Storage</h3>
                    <p className="mb-3 text-muted-foreground">
                      Project data moved from <code className="text-cat-mauve">.prjct/</code> to{' '}
                      <code className="text-cat-mauve">~/.prjct-cli/projects/[id]/</code>
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Prevents bundle size inflation</li>
                      <li>• No accidental commits of personal work logs</li>
                      <li>• Better privacy for productivity tracking</li>
                      <li>• Layered structure: core, progress, planning, analysis, memory</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Author Tracking */}
              <div className="rounded-2xl bg-muted/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Author Detection & Tracking</h3>
                    <p className="mb-3 text-muted-foreground">
                      All operations now include author information for collaboration readiness.
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        • Auto-detection via GitHub CLI (
                        <code className="text-cat-mauve">gh api user</code>)
                      </li>
                      <li>• Fallback to git config for name and email</li>
                      <li>• Every log entry includes author field</li>
                      <li>• Prepares for multi-user collaboration features</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Migration Guide CTA */}
            <div className="mt-8 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5 p-6">
              <h3 className="mb-2 text-xl font-bold">Need to Migrate?</h3>
              <p className="mb-4 text-muted-foreground">
                Migrating from v0.1.0 is simple and safe. Zero data loss guaranteed.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/docs/migration"
                  className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Read Migration Guide
                </Link>
                <a
                  href="https://github.com/jlopezlira/prjct-cli"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-muted/50 px-6 py-3 font-medium transition-colors hover:bg-muted"
                >
                  View on GitHub
                </a>
              </div>
            </div>

            {/* Technical Details */}
            <details className="mt-8 cursor-pointer rounded-2xl bg-muted/10 p-6">
              <summary className="mb-4 text-lg font-semibold">
                Technical Details & Full Changelog
              </summary>
              <div className="space-y-6 text-sm">
                {/* Added */}
                <div>
                  <h4 className="mb-2 flex items-center gap-2 font-bold text-cat-green">
                    <Plus className="h-4 w-4" />
                    Added
                  </h4>
                  <ul className="ml-6 space-y-1 text-muted-foreground">
                    <li>
                      • New core modules: path-manager, config-manager, author-detector, migrator
                    </li>
                    <li>• Automatic migration system with integrity validation</li>
                    <li>• Project configuration system (prjct.config.json)</li>
                    <li>• Layered global storage structure</li>
                    <li>• Author tracking in all memory logs</li>
                  </ul>
                </div>

                {/* Changed */}
                <div>
                  <h4 className="mb-2 flex items-center gap-2 font-bold text-cat-yellow">
                    <Wrench className="h-4 w-4" />
                    Changed
                  </h4>
                  <ul className="ml-6 space-y-1 text-muted-foreground">
                    <li>• Data location: .prjct/ → ~/.prjct-cli/projects/[id]/</li>
                    <li>• Memory logs now include author field</li>
                    <li>• File structure organized into layers</li>
                    <li>• Initialization creates global structure and config</li>
                  </ul>
                </div>

                {/* Removed */}
                <div>
                  <h4 className="mb-2 flex items-center gap-2 font-bold text-cat-red">
                    <Trash2 className="h-4 w-4" />
                    Removed
                  </h4>
                  <ul className="ml-6 space-y-1 text-muted-foreground">
                    <li>• Local .prjct/ directory usage (replaced with global storage)</li>
                    <li>• Legacy flat file structure (replaced with layered architecture)</li>
                  </ul>
                </div>
              </div>
            </details>
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
