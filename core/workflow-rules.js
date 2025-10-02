/**
 * Workflow Rules
 * Defines workflows by task type with capability requirements
 */

module.exports = {
  // UI Component workflow
  ui: [
    {
      name: 'design',
      agent: 'frontend',
      action: 'Create component design',
      required: false,
      needs: 'design',
      prompt: true,
    },
    {
      name: 'dev',
      agent: 'frontend',
      action: 'Implement component',
      required: true,
    },
    {
      name: 'test',
      agent: 'qa',
      action: 'Create tests',
      required: false,
      needs: 'test',
      retry: 3,
      prompt: true,
    },
    {
      name: 'docs',
      agent: 'scribe',
      action: 'Document component',
      required: false,
      needs: 'docs',
      prompt: true,
    },
  ],

  // API Endpoint workflow
  api: [
    {
      name: 'dev',
      agent: 'backend',
      action: 'Implement endpoint',
      required: true,
    },
    {
      name: 'test',
      agent: 'qa',
      action: 'Create API tests',
      required: false,
      needs: 'test',
      retry: 3,
      prompt: true,
    },
    {
      name: 'docs',
      agent: 'scribe',
      action: 'Document API',
      required: false,
      needs: 'docs',
      prompt: true,
    },
  ],

  // Bug Fix workflow
  bug: [
    {
      name: 'analyze',
      agent: 'analyzer',
      action: 'Analyze bug',
      required: true,
    },
    {
      name: 'fix',
      agent: 'auto',
      action: 'Fix bug',
      required: true,
    },
    {
      name: 'test',
      agent: 'qa',
      action: 'Verify fix',
      required: false,
      needs: 'test',
      retry: 3,
      prompt: true,
    },
  ],

  // Refactor workflow
  refactor: [
    {
      name: 'refactor',
      agent: 'refactorer',
      action: 'Refactor code',
      required: true,
    },
    {
      name: 'test',
      agent: 'qa',
      action: 'Verify refactor',
      required: false,
      needs: 'test',
      retry: 3,
      prompt: true,
    },
  ],

  // Feature workflow (complete feature)
  feature: [
    {
      name: 'design',
      agent: 'architect',
      action: 'Design feature',
      required: false,
      needs: 'design',
      prompt: true,
    },
    {
      name: 'dev',
      agent: 'auto',
      action: 'Implement feature',
      required: true,
    },
    {
      name: 'test',
      agent: 'qa',
      action: 'Test feature',
      required: false,
      needs: 'test',
      retry: 3,
      prompt: true,
    },
    {
      name: 'docs',
      agent: 'scribe',
      action: 'Document feature',
      required: false,
      needs: 'docs',
      prompt: true,
    },
  ],
}
