/**
 * Architecture Generator - Transforms ideas into complete technical specifications
 * Uses AI-driven methodology to develop ideas through discovery, design, and planning phases
 */

const path = require('path');
const fs = require('fs').promises;

class ArchitectureGenerator {
  constructor() {
    this.phases = [
      'discovery',
      'user-flows',
      'domain-modeling',
      'api-design',
      'architecture',
      'data-design',
      'tech-stack',
      'roadmap'
    ];
  }

  /**
   * Generate complete architecture from an idea
   * @param {string} idea - The initial idea description
   * @param {object} context - Project context and constraints
   * @returns {Promise<object>} Complete architecture specification
   */
  async generateArchitecture(idea, context = {}) {
    const architecture = {
      id: `arch-${Date.now()}`,
      idea,
      createdAt: new Date().toISOString(),
      phases: {}
    };

    // Phase 1: Discovery & Problem Definition
    architecture.phases.discovery = await this.discovery(idea, context);

    // Phase 2: User Flows & Journeys
    architecture.phases.userFlows = await this.userFlows();

    // Phase 3: Domain Modeling
    architecture.phases.domainModel = await this.domainModeling();

    // Phase 4: API Contract Design
    architecture.phases.apiDesign = await this.apiDesign();

    // Phase 5: System Architecture
    architecture.phases.systemArchitecture = await this.systemArchitecture();

    // Phase 6: Data Architecture
    architecture.phases.dataArchitecture = await this.dataArchitecture(
      architecture.phases.domainModel
    );

    // Phase 7: Tech Stack Decision
    architecture.phases.techStack = await this.techStackDecision();

    // Phase 8: Implementation Roadmap
    architecture.phases.roadmap = await this.roadmap();

    return architecture;
  }

  /**
   * Phase 1: Discovery & Problem Definition
   */
  async discovery(idea, context) {
    return {
      problemStatement: {
        problem: `Analyzing: ${idea}`,
        currentPainPoint: 'To be determined through analysis',
        impact: 'To be evaluated'
      },
      targetUsers: {
        primary: {
          persona: 'Primary User',
          goals: [],
          frustrations: [],
          technicalProficiency: 'medium'
        },
        secondary: []
      },
      constraints: {
        budget: context.budget || 'bootstrapped',
        timeline: context.timeline || 'MVP in 4 weeks',
        teamSize: context.teamSize || 1,
        regulatory: context.regulatory || []
      },
      successMetrics: {
        primary: 'User adoption rate',
        secondary: ['engagement', 'retention'],
        mvpThreshold: '100 active users'
      }
    };
  }

  /**
   * Phase 2: User Flows & Journeys
   */
  async userFlows() {
    return {
      coreJourneys: [
        {
          name: 'Primary User Flow',
          entryPoint: 'Landing page or direct link',
          steps: [
            { action: 'Arrive', response: 'Show welcome', next: 'Onboarding' },
            { action: 'Complete onboarding', response: 'Create account', next: 'Dashboard' },
            { action: 'Use core feature', response: 'Process request', next: 'Results' }
          ],
          successState: 'Task completed successfully',
          errorStates: ['Network error', 'Validation error', 'Permission denied']
        }
      ],
      jobsToBeDone: [
        {
          situation: 'When I need to solve the core problem',
          motivation: 'I want to use this solution',
          expectedOutcome: 'So I can achieve my goal efficiently'
        }
      ]
    };
  }

  /**
   * Phase 3: Domain Modeling
   */
  async domainModeling() {
    return {
      entities: [
        {
          name: 'User',
          description: 'System user account',
          attributes: [
            { name: 'id', type: 'uuid', constraints: 'primary key' },
            { name: 'email', type: 'string', constraints: 'unique, not null' },
            { name: 'createdAt', type: 'timestamp', constraints: 'not null' }
          ],
          relationships: [],
          businessRules: ['Email must be verified', 'User must accept terms'],
          lifecycle: ['pending', 'active', 'suspended', 'deleted']
        }
      ],
      boundedContexts: [
        {
          name: 'User Management',
          entities: ['User', 'Profile', 'Session'],
          dependencies: [],
          eventsPublished: ['UserCreated', 'UserUpdated'],
          eventsConsumed: []
        }
      ]
    };
  }

  /**
   * Phase 4: API Design
   */
  async apiDesign() {
    return {
      style: 'REST',
      reasoning: 'Simple CRUD operations with broad compatibility',
      endpoints: [
        {
          name: 'Create User',
          method: 'POST',
          path: '/api/users',
          authentication: 'Optional',
          inputSchema: {
            email: 'string',
            password: 'string'
          },
          outputSchema: {
            id: 'string',
            email: 'string',
            createdAt: 'string'
          },
          errorResponses: [
            { code: 400, description: 'Invalid input' },
            { code: 409, description: 'Email already exists' }
          ]
        }
      ],
      authentication: {
        method: 'JWT',
        implementation: 'Lucia',
        tokenStorage: 'httpOnly cookie',
        sessionDuration: '7 days'
      }
    };
  }

  /**
   * Phase 5: System Architecture
   */
  async systemArchitecture() {
    return {
      pattern: 'Modular Monolith',
      reasoning: 'Fast iteration for MVP with small team',
      components: {
        frontend: 'Next.js App',
        backend: 'Next.js API Routes',
        database: 'PostgreSQL',
        cache: 'Redis',
        storage: 'S3-compatible'
      },
      deploymentModel: 'Serverless (Vercel)',
      scalingStrategy: 'Horizontal with auto-scaling'
    };
  }

  /**
   * Phase 6: Data Architecture
   */
  async dataArchitecture(domainModel) {
    const schemas = [];

    for (const entity of domainModel.entities) {
      schemas.push({
        table: entity.name.toLowerCase() + 's',
        columns: entity.attributes,
        indexes: [
          { name: `idx_${entity.name.toLowerCase()}_created`, columns: ['createdAt'] }
        ],
        relationships: entity.relationships
      });
    }

    return {
      primaryDatabase: 'PostgreSQL',
      reasoning: 'ACID compliance, complex queries, proven reliability',
      schemas,
      caching: {
        strategy: 'Cache-aside',
        ttl: {
          user: 3600,
          session: 1800
        }
      },
      migration: {
        tool: 'Drizzle Kit',
        strategy: 'Forward-only migrations'
      }
    };
  }

  /**
   * Phase 7: Tech Stack Decision
   */
  async techStackDecision() {
    return {
      frontend: {
        framework: 'Next.js 14',
        styling: 'Tailwind CSS',
        state: 'Zustand',
        forms: 'React Hook Form',
        dataFetching: 'TanStack Query',
        ui: 'shadcn/ui'
      },
      backend: {
        runtime: 'Node.js',
        framework: 'Next.js API Routes',
        orm: 'Drizzle',
        validation: 'Zod',
        auth: 'Lucia',
        background: 'Inngest'
      },
      infrastructure: {
        hosting: 'Vercel',
        database: 'Neon',
        cache: 'Upstash Redis',
        storage: 'Cloudflare R2',
        monitoring: 'Sentry'
      },
      reasoning: {
        frontend: 'Type-safe, modern DX, strong ecosystem',
        backend: 'Unified codebase, serverless-first',
        infrastructure: 'Cost-effective for MVP, scales well'
      }
    };
  }

  /**
   * Phase 8: Implementation Roadmap
   */
  async roadmap() {
    return {
      mvpScope: {
        goal: 'Validate core value proposition',
        features: [
          'User authentication',
          'Core feature implementation',
          'Basic dashboard',
          'Essential API endpoints'
        ],
        excluded: [
          'Advanced analytics',
          'Third-party integrations',
          'Mobile app'
        ],
        successCriteria: {
          users: 100,
          retention: '40% weekly active'
        }
      },
      phases: [
        {
          name: 'Phase 1: Foundation',
          duration: '1 week',
          tasks: [
            'Project setup and configuration',
            'Database schema and migrations',
            'Authentication system',
            'Basic UI components'
          ],
          deliverable: 'Working authentication and base UI'
        },
        {
          name: 'Phase 2: Core Features',
          duration: '2 weeks',
          tasks: [
            'Implement core domain logic',
            'API endpoints',
            'User dashboard',
            'Data validation'
          ],
          deliverable: 'Functional MVP'
        },
        {
          name: 'Phase 3: Polish & Launch',
          duration: '1 week',
          tasks: [
            'Error handling',
            'Performance optimization',
            'Security audit',
            'Production deployment'
          ],
          deliverable: 'Production-ready application'
        }
      ],
      estimatedTotal: '4 weeks',
      risks: [
        {
          risk: 'Scope creep',
          mitigation: 'Strict MVP feature set'
        },
        {
          risk: 'Technical complexity',
          mitigation: 'Use proven patterns and libraries'
        }
      ]
    };
  }

  /**
   * Save architecture to files
   */
  async saveArchitecture(architecture, projectPath) {
    const archPath = path.join(projectPath, 'planning', 'architectures', architecture.id);
    await fs.mkdir(archPath, { recursive: true });

    // Save each phase as a separate markdown file
    const files = {
      'discovery.md': this.formatDiscovery(architecture.phases.discovery),
      'user-flows.md': this.formatUserFlows(architecture.phases.userFlows),
      'domain-model.md': this.formatDomainModel(architecture.phases.domainModel),
      'api-spec.md': this.formatApiSpec(architecture.phases.apiDesign),
      'architecture.md': this.formatArchitecture(architecture.phases.systemArchitecture),
      'database.sql': this.generateSQLSchema(architecture.phases.dataArchitecture),
      'tech-stack.md': this.formatTechStack(architecture.phases.techStack),
      'roadmap.md': this.formatRoadmap(architecture.phases.roadmap),
      'summary.json': JSON.stringify(architecture, null, 2)
    };

    for (const [filename, content] of Object.entries(files)) {
      await fs.writeFile(path.join(archPath, filename), content);
    }

    return archPath;
  }

  // Formatting methods for each phase
  formatDiscovery(discovery) {
    return `# Discovery & Problem Definition

## Problem Statement

**Problem**: ${discovery.problemStatement.problem}
**Current Pain Point**: ${discovery.problemStatement.currentPainPoint}
**Impact**: ${discovery.problemStatement.impact}

## Target Users

### Primary User
- **Persona**: ${discovery.targetUsers.primary.persona}
- **Technical Proficiency**: ${discovery.targetUsers.primary.technicalProficiency}

## Constraints
- **Budget**: ${discovery.constraints.budget}
- **Timeline**: ${discovery.constraints.timeline}
- **Team Size**: ${discovery.constraints.teamSize}

## Success Metrics
- **Primary KPI**: ${discovery.successMetrics.primary}
- **MVP Threshold**: ${discovery.successMetrics.mvpThreshold}
`;
  }

  formatUserFlows(userFlows) {
    let content = '# User Flows & Journeys\n\n';

    for (const journey of userFlows.coreJourneys) {
      content += `## ${journey.name}\n\n`;
      content += `**Entry Point**: ${journey.entryPoint}\n\n`;
      content += '### Steps\n';
      for (const step of journey.steps) {
        content += `1. **${step.action}** → ${step.response} → ${step.next}\n`;
      }
      content += `\n**Success State**: ${journey.successState}\n\n`;
    }

    return content;
  }

  formatDomainModel(domainModel) {
    let content = '# Domain Model\n\n## Entities\n\n';

    for (const entity of domainModel.entities) {
      content += `### ${entity.name}\n`;
      content += `${entity.description}\n\n`;
      content += '**Attributes**:\n';
      for (const attr of entity.attributes) {
        content += `- ${attr.name}: ${attr.type} (${attr.constraints})\n`;
      }
      content += '\n';
    }

    return content;
  }

  formatApiSpec(apiDesign) {
    let content = `# API Specification\n\n`;
    content += `**Style**: ${apiDesign.style}\n`;
    content += `**Reasoning**: ${apiDesign.reasoning}\n\n`;
    content += '## Endpoints\n\n';

    for (const endpoint of apiDesign.endpoints) {
      content += `### ${endpoint.name}\n`;
      content += `- **Method**: ${endpoint.method}\n`;
      content += `- **Path**: ${endpoint.path}\n`;
      content += `- **Authentication**: ${endpoint.authentication}\n\n`;
    }

    return content;
  }

  formatArchitecture(architecture) {
    return `# System Architecture

**Pattern**: ${architecture.pattern}
**Reasoning**: ${architecture.reasoning}

## Components
- **Frontend**: ${architecture.components.frontend}
- **Backend**: ${architecture.components.backend}
- **Database**: ${architecture.components.database}
- **Cache**: ${architecture.components.cache}

## Deployment
- **Model**: ${architecture.deploymentModel}
- **Scaling**: ${architecture.scalingStrategy}
`;
  }

  generateSQLSchema(dataArchitecture) {
    let sql = '-- Generated Database Schema\n\n';

    for (const schema of dataArchitecture.schemas) {
      sql += `CREATE TABLE ${schema.table} (\n`;
      for (const col of schema.columns) {
        sql += `  ${col.name} ${this.sqlType(col.type)} ${col.constraints || ''},\n`;
      }
      sql = sql.slice(0, -2) + '\n);\n\n';

      for (const index of schema.indexes) {
        sql += `CREATE INDEX ${index.name} ON ${schema.table}(${index.columns.join(', ')});\n`;
      }
      sql += '\n';
    }

    return sql;
  }

  sqlType(type) {
    const typeMap = {
      'uuid': 'UUID',
      'string': 'VARCHAR(255)',
      'text': 'TEXT',
      'int': 'INTEGER',
      'timestamp': 'TIMESTAMP',
      'boolean': 'BOOLEAN',
      'json': 'JSONB'
    };
    return typeMap[type] || 'TEXT';
  }

  formatTechStack(techStack) {
    return `# Tech Stack Decision

## Frontend
- **Framework**: ${techStack.frontend.framework}
- **Styling**: ${techStack.frontend.styling}
- **State Management**: ${techStack.frontend.state}
- **Forms**: ${techStack.frontend.forms}
- **Data Fetching**: ${techStack.frontend.dataFetching}
- **UI Library**: ${techStack.frontend.ui}

## Backend
- **Runtime**: ${techStack.backend.runtime}
- **Framework**: ${techStack.backend.framework}
- **ORM**: ${techStack.backend.orm}
- **Validation**: ${techStack.backend.validation}
- **Auth**: ${techStack.backend.auth}

## Infrastructure
- **Hosting**: ${techStack.infrastructure.hosting}
- **Database**: ${techStack.infrastructure.database}
- **Cache**: ${techStack.infrastructure.cache}
- **Monitoring**: ${techStack.infrastructure.monitoring}
`;
  }

  formatRoadmap(roadmap) {
    let content = `# Implementation Roadmap\n\n`;
    content += `## MVP Scope\n\n`;
    content += `**Goal**: ${roadmap.mvpScope.goal}\n\n`;
    content += '### Included Features\n';
    for (const feature of roadmap.mvpScope.features) {
      content += `- ${feature}\n`;
    }
    content += '\n## Development Phases\n\n';

    for (const phase of roadmap.phases) {
      content += `### ${phase.name}\n`;
      content += `**Duration**: ${phase.duration}\n\n`;
      content += '**Tasks**:\n';
      for (const task of phase.tasks) {
        content += `- ${task}\n`;
      }
      content += `\n**Deliverable**: ${phase.deliverable}\n\n`;
    }

    content += `## Total Estimate: ${roadmap.estimatedTotal}\n`;

    return content;
  }
}

module.exports = ArchitectureGenerator;