/**
 * Ground Truth Types
 */

export interface Context {
  projectPath: string
  projectId?: string | null
  paths: {
    now: string
    next: string
    metrics: string
    shipped: string
    roadmap: string
    specs: string
    [key: string]: string
  }
  params: {
    feature?: string
    description?: string
    task?: string
    name?: string
    [key: string]: unknown
  }
}

export interface VerificationResult {
  verified: boolean
  actual: Record<string, unknown>
  warnings: string[]
  recommendations: string[]
}

export type Verifier = (context: Context, state: unknown) => Promise<VerificationResult>
