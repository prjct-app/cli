import { motion } from 'framer-motion'
import {
  Sparkles,
  Zap,
  ArrowRight,
  CheckCircle,
  Settings,
  Code,
  TestTube,
  FileText,
  Layers,
  GitBranch,
  AlertTriangle,
  Play
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'

export const WorkflowsGuide = () => {
  const [activeWorkflow, setActiveWorkflow] = useState<string>('ui')
  const [activeUseCase, setActiveUseCase] = useState<string>('login')

  const workflowTypes = {
    ui: {
      name: 'UI Component',
      icon: <Layers className="w-5 h-5" />,
      color: 'text-cat-mauve',
      steps: [
        { name: 'Design', agent: 'frontend', optional: true, needs: 'design' },
        { name: 'Dev', agent: 'frontend', optional: false },
        { name: 'Test', agent: 'qa', optional: true, needs: 'test' },
        { name: 'Docs', agent: 'scribe', optional: true, needs: 'docs' }
      ],
      example: 'Create user login form'
    },
    api: {
      name: 'API Endpoint',
      icon: <Code className="w-5 h-5" />,
      color: 'text-cat-blue',
      steps: [
        { name: 'Dev', agent: 'backend', optional: false },
        { name: 'Test', agent: 'qa', optional: true, needs: 'test' },
        { name: 'Docs', agent: 'scribe', optional: true, needs: 'docs' }
      ],
      example: 'Add authentication endpoint'
    },
    bug: {
      name: 'Bug Fix',
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'text-cat-red',
      steps: [
        { name: 'Analyze', agent: 'analyzer', optional: false },
        { name: 'Fix', agent: 'auto', optional: false },
        { name: 'Test', agent: 'qa', optional: true, needs: 'test' }
      ],
      example: 'Fix slow dashboard rendering'
    },
    refactor: {
      name: 'Refactor',
      icon: <GitBranch className="w-5 h-5" />,
      color: 'text-cat-yellow',
      steps: [
        { name: 'Refactor', agent: 'refactorer', optional: false },
        { name: 'Test', agent: 'qa', optional: true, needs: 'test' }
      ],
      example: 'Optimize data fetching logic'
    },
    feature: {
      name: 'Feature',
      icon: <Sparkles className="w-5 h-5" />,
      color: 'text-cat-green',
      steps: [
        { name: 'Design', agent: 'architect', optional: true, needs: 'design' },
        { name: 'Dev', agent: 'auto', optional: false },
        { name: 'Test', agent: 'qa', optional: true, needs: 'test' },
        { name: 'Docs', agent: 'scribe', optional: true, needs: 'docs' }
      ],
      example: 'Build notification system'
    }
  }

  const useCases = {
    login: {
      title: 'Create Login Form',
      workflow: 'ui',
      stack: 'React + TypeScript',
      hasTest: false,
      steps: [
        { phase: 'Classify', result: 'UI workflow detected' },
        { phase: 'Detect Stack', result: 'React + TS, no testing framework' },
        { phase: 'Prompt', result: 'Install Vitest + Testing Library?' },
        { phase: 'User Choice', result: 'Install (option 1)' },
        { phase: 'Install', result: 'Vitest configured (1.2 min)', tracking: true },
        { phase: 'Execute', result: 'Design → Dev → Test → Docs' },
        { phase: 'Output', result: 'Complete form with tests' }
      ]
    },
    api: {
      title: 'Build REST API',
      workflow: 'api',
      stack: 'Node.js + Express',
      hasTest: true,
      steps: [
        { phase: 'Classify', result: 'API workflow detected' },
        { phase: 'Detect Stack', result: 'Node.js + Express, Jest installed' },
        { phase: 'No Prompt', result: 'All capabilities present' },
        { phase: 'Execute', result: 'Dev → Test → Docs' },
        { phase: 'Output', result: 'Endpoint with tests and API docs' }
      ]
    },
    bug: {
      title: 'Fix Performance Bug',
      workflow: 'bug',
      stack: 'React + Vite',
      hasTest: true,
      steps: [
        { phase: 'Classify', result: 'Bug fix workflow detected' },
        { phase: 'Detect Stack', result: 'All capabilities OK' },
        { phase: 'Execute', result: 'Analyze → Fix → Test' },
        { phase: 'Output', result: 'Bug fixed with verification' }
      ]
    }
  }

  const stackRecommendations = [
    { framework: 'React + TS', test: 'Vitest + Testing Library', install: 'npm install -D vitest @testing-library/react' },
    { framework: 'Vue', test: 'Vitest + @vue/test-utils', install: 'npm install -D vitest @vue/test-utils' },
    { framework: 'Angular', test: 'Jest + @types/jest', install: 'npm install -D jest @types/jest ts-jest' },
    { framework: 'Next.js', test: 'Vitest + Testing Library', install: 'npm install -D vitest @testing-library/react' },
    { framework: 'Node.js', test: 'Jest or Vitest', install: 'npm install -D jest' }
  ]

  return (
    <div className="min-h-screen py-20 px-4">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-6xl mx-auto text-center mb-20"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">v0.4.0 Feature</span>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          Interactive Workflow System
        </h1>

        <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
          Intelligent agent workflows with user-guided capability installation.
          Workflows detect missing tools and prompt for decisions—never auto-skip again.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {Object.entries(workflowTypes).map(([key, workflow]) => (
            <button
              key={key}
              onClick={() => setActiveWorkflow(key)}
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                activeWorkflow === key
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={workflow.color}>{workflow.icon}</span>
                <span className="font-medium">{workflow.name}</span>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* How It Works - Flow Diagram */}
      <section className="max-w-6xl mx-auto mb-20">
        <h2 className="text-3xl font-bold mb-8 text-center">How It Works</h2>

        <div className="grid md:grid-cols-5 gap-4">
          {[
            { icon: <Settings />, title: 'Detect Capabilities', desc: 'Scan project for design, test, docs tools' },
            { icon: <GitBranch />, title: 'Classify Task', desc: 'Auto-detect workflow type from description' },
            { icon: <Play />, title: 'Generate Workflow', desc: 'Create step-by-step execution plan' },
            { icon: <AlertTriangle />, title: 'Interactive Prompts', desc: 'Ask before skipping or installing' },
            { icon: <Sparkles />, title: 'Execute with Agents', desc: 'Run each step with specialized agents' }
          ].map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              viewport={{ once: true }}
              className="p-6 bg-muted/20 rounded-xl text-center"
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                {step.icon}
              </div>
              <h3 className="font-bold mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Active Workflow Details */}
      <section className="max-w-6xl mx-auto mb-20">
        <h2 className="text-3xl font-bold mb-8 text-center">
          {workflowTypes[activeWorkflow as keyof typeof workflowTypes].name} Workflow
        </h2>

        <div className="relative isolate overflow-visible">
          <div className="fancy-border pointer-events-none"></div>
          <div className="relative z-10 p-10 bg-gradient-to-br from-background to-muted/20 rounded-2xl border border-border">
            {/* Example Badge */}
            <div className="mb-10 text-center">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-primary/20 to-primary/10 rounded-full border border-primary/30">
                <Code className="w-5 h-5 text-primary" />
                <span className="font-semibold text-lg">
                  {workflowTypes[activeWorkflow as keyof typeof workflowTypes].example}
                </span>
              </div>
            </div>

            {/* Workflow Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {workflowTypes[activeWorkflow as keyof typeof workflowTypes].steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="relative"
                >
                  {/* Step Card */}
                  <div className={`relative p-5 rounded-2xl h-full transition-all duration-300 ${
                    step.optional
                      ? 'bg-muted/30 border-2 border-dashed border-muted-foreground/40 hover:border-muted-foreground/60'
                      : 'bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/50 hover:border-primary/70 shadow-lg shadow-primary/10'
                  }`}>

                    {/* Step Number Badge */}
                    <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-lg z-10">
                      {i + 1}
                    </div>

                    {/* Icon and Title */}
                    <div className="text-center mb-4 pt-2">
                      <div className={`w-16 h-16 mx-auto rounded-xl mb-3 flex items-center justify-center ${
                        step.optional ? 'bg-muted/50' : 'bg-primary/20'
                      } shadow-md`}>
                        {step.name === 'Design' && <Sparkles className="w-8 h-8 text-cat-mauve" />}
                        {step.name === 'Dev' && <Code className="w-8 h-8 text-cat-blue" />}
                        {step.name === 'Test' && <TestTube className="w-8 h-8 text-cat-green" />}
                        {step.name === 'Docs' && <FileText className="w-8 h-8 text-cat-yellow" />}
                        {step.name === 'Analyze' && <Settings className="w-8 h-8 text-cat-sapphire" />}
                        {step.name === 'Fix' && <CheckCircle className="w-8 h-8 text-cat-green" />}
                        {step.name === 'Refactor' && <GitBranch className="w-8 h-8 text-cat-peach" />}
                      </div>
                      <h4 className="font-bold text-xl mb-2">{step.name}</h4>
                      {step.optional && (
                        <span className="inline-block text-xs px-3 py-1 bg-muted rounded-full text-muted-foreground">
                          Optional Step
                        </span>
                      )}
                    </div>

                    {/* Agent Info */}
                    <div className="space-y-2">
                      <div className="px-3 py-2 bg-background/50 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground mb-1">Assigned Agent</p>
                        <p className="font-semibold text-primary">{step.agent}</p>
                      </div>

                      {step.needs && (
                        <div className="flex items-center justify-center gap-2 px-3 py-2 bg-cat-yellow/10 rounded-lg border border-cat-yellow/30">
                          <AlertTriangle className="w-4 h-4 text-cat-yellow flex-shrink-0" />
                          <span className="text-sm text-cat-yellow font-medium">
                            Needs {step.needs}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Arrow indicator for flow - only on larger screens */}
                    {i < workflowTypes[activeWorkflow as keyof typeof workflowTypes].steps.length - 1 && (
                      <div className="hidden lg:block absolute -right-8 top-1/2 -translate-y-1/2 z-20">
                        <ArrowRight className="w-6 h-6 text-primary/60" />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Prompts Section */}
      <section className="max-w-6xl mx-auto mb-20">
        <h2 className="text-3xl font-bold mb-8 text-center">Smart Prompting System</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 bg-muted/20 rounded-xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-cat-green" />
              When Capability Exists
            </h3>
            <div className="space-y-3 font-mono text-sm">
              <div className="p-3 bg-background/50 rounded border border-border">
                <p className="text-cat-green mb-2">✓ Testing framework detected</p>
                <p className="text-muted-foreground">→ Execute test step normally</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-muted/20 rounded-xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-cat-yellow" />
              When Capability Missing
            </h3>
            <div className="space-y-3 font-mono text-sm">
              <div className="p-3 bg-background/50 rounded border border-cat-yellow/30">
                <p className="text-cat-yellow mb-3">⚠️ Missing test capability</p>
                <p className="text-muted-foreground mb-2">📋 Recommended: Vitest + Testing Library</p>
                <p className="text-muted-foreground mb-3">💡 Reason: Quality assurance</p>
                <div className="space-y-1 text-xs">
                  <p>1. Install (npm install -D vitest)</p>
                  <p>2. Skip this step</p>
                  <p>3. Continue without test</p>
                  <p>4. Pause workflow</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Real Use Cases */}
      <section className="max-w-6xl mx-auto mb-20">
        <h2 className="text-3xl font-bold mb-8 text-center">Real-World Examples</h2>

        <div className="flex justify-center gap-4 mb-8">
          {Object.entries(useCases).map(([key, useCase]) => (
            <button
              key={key}
              onClick={() => setActiveUseCase(key)}
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                activeUseCase === key
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {useCase.title}
            </button>
          ))}
        </div>

        <div className="p-8 bg-muted/20 rounded-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold">
              {useCases[activeUseCase as keyof typeof useCases].title}
            </h3>
            <span className="px-3 py-1 bg-primary/20 rounded-full text-sm">
              {useCases[activeUseCase as keyof typeof useCases].stack}
            </span>
          </div>

          <div className="space-y-4">
            {useCases[activeUseCase as keyof typeof useCases].steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                className={`p-4 rounded-lg border ${
                  'tracking' in step && step.tracking
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-background/50 border-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-primary">{i + 1}.</span>
                  <span className="font-semibold">{step.phase}:</span>
                  <span className="text-muted-foreground">{step.result}</span>
                  {'tracking' in step && step.tracking && (
                    <span className="ml-auto px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
                      Tracked
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stack Detection Table */}
      <section className="max-w-6xl mx-auto mb-20">
        <h2 className="text-3xl font-bold mb-8 text-center">Stack-Aware Recommendations</h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4">Framework Detected</th>
                <th className="text-left p-4">Test Recommendation</th>
                <th className="text-left p-4">Install Command</th>
              </tr>
            </thead>
            <tbody>
              {stackRecommendations.map((rec, i) => (
                <tr key={i} className="border-b border-border hover:bg-muted/20">
                  <td className="p-4 font-medium">{rec.framework}</td>
                  <td className="p-4 text-muted-foreground">{rec.test}</td>
                  <td className="p-4">
                    <code className="text-sm bg-background px-2 py-1 rounded">
                      {rec.install}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Advanced Features */}
      <section className="max-w-6xl mx-auto mb-20">
        <h2 className="text-3xl font-bold mb-8 text-center">Advanced Features</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 bg-muted/20 rounded-xl">
            <FileText className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-3">State Persistence</h3>
            <p className="text-muted-foreground text-sm">
              Workflows saved to state.json with full history, timestamps, and metadata
            </p>
          </div>

          <div className="p-6 bg-muted/20 rounded-xl">
            <Settings className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-3">Auto-Configuration</h3>
            <p className="text-muted-foreground text-sm">
              Installed tools are automatically configured with framework-specific settings
            </p>
          </div>

          <div className="p-6 bg-muted/20 rounded-xl">
            <TestTube className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-3">Installation Tracking</h3>
            <p className="text-muted-foreground text-sm">
              Every tool installation becomes a visible workflow task with duration
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="max-w-4xl mx-auto text-center p-8 bg-gradient-to-r from-primary/10 to-transparent rounded-2xl border border-primary/20"
      >
        <h2 className="text-3xl font-bold mb-4">Ready to Try Interactive Workflows?</h2>
        <p className="text-muted-foreground mb-6">
          Start with `/p:idea` and let the workflow system guide you through the process
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/commands"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            View All Commands
          </Link>
          <a
            href="https://github.com/jlopezlira/prjct-cli"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </motion.div>
    </div>
  )
}
