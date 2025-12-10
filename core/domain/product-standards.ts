/**
 * Modern Product Standards
 * Defines what "Good" looks like for each domain.
 * Used to inject high standards into agent prompts.
 */

interface DomainStandard {
  title: string
  rules: string[]
}

interface Standards {
  title: string
  rules: string[]
}

interface ProductStandardsType {
  general: string[]
  domains: Record<string, DomainStandard>
  getStandards(domain?: string): Standards
}

const ProductStandards: ProductStandardsType = {
  // General standards applicable to all agents
  general: [
    'SHIP IT: Bias for action. Better to ship and iterate than perfect and delay.',
    'USER CENTRIC: Always ask "How does this help the user?"',
    'CLEAN CODE: Write code that is easy to read, test, and maintain.',
    'NO BS: Avoid over-engineering. Simple is better than complex.',
  ],

  // Domain-specific standards
  domains: {
    frontend: {
      title: 'Modern Frontend Standards',
      rules: [
        'PERFORMANCE: Core Web Vitals matter. Optimize LCP, CLS, FID.',
        'ACCESSIBILITY: Semantic HTML, ARIA labels, keyboard navigation (WCAG 2.1 AA).',
        'RESPONSIVE: Mobile-first design. Works on all devices.',
        'UX/UI: Smooth transitions, loading states, error boundaries. No dead clicks.',
        'STATE: Local state for UI, Global state (Context/Zustand) for data. No prop drilling.',
      ],
    },
    backend: {
      title: 'Robust Backend Standards',
      rules: [
        'SECURITY: Validate ALL inputs. Sanitize outputs. OWASP Top 10 awareness.',
        'SCALABILITY: Stateless services. Caching strategies (Redis/CDN).',
        'RELIABILITY: Graceful error handling. Structured logging. Health checks.',
        'API DESIGN: RESTful or GraphQL best practices. Consistent response envelopes.',
        'DB: Indexed queries. Migrations for schema changes. No N+1 queries.',
      ],
    },
    database: {
      title: 'Data Integrity Standards',
      rules: [
        'INTEGRITY: Foreign keys, constraints, transactions.',
        'PERFORMANCE: Index usage analysis. Query optimization.',
        'BACKUPS: Point-in-time recovery awareness.',
        'MIGRATIONS: Idempotent scripts. Zero-downtime changes.',
      ],
    },
    devops: {
      title: 'Modern Ops Standards',
      rules: [
        'AUTOMATION: CI/CD for everything. No manual deployments.',
        'IaC: Infrastructure as Code (Terraform/Pulumi).',
        'OBSERVABILITY: Metrics, Logs, Traces (OpenTelemetry).',
        'SECURITY: Least privilege access. Secrets management.',
      ],
    },
    qa: {
      title: 'Quality Assurance Standards',
      rules: [
        'PYRAMID: Many unit tests, some integration, few E2E.',
        'COVERAGE: Critical paths must be tested.',
        'REALISM: Test with realistic data and scenarios.',
        'SPEED: Fast feedback loops. Parallel execution.',
      ],
    },
    architecture: {
      title: 'System Architecture Standards',
      rules: [
        'MODULARITY: High cohesion, low coupling.',
        'EVOLVABILITY: Easy to change. Hard to break.',
        'SIMPLICITY: Choose boring technology. Innovation tokens are limited.',
        'DOCS: Architecture Decision Records (ADRs).',
      ],
    },
  },

  /**
   * Get standards for a specific domain
   */
  getStandards(domain?: string): Standards {
    const key = domain?.toLowerCase()
    const specific = (key && this.domains[key]) || { title: 'General Standards', rules: [] }

    return {
      title: specific.title,
      rules: [...this.general, ...specific.rules],
    }
  },
}

export default ProductStandards
