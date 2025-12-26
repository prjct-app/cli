/**
 * Template Types
 * Types for command templates.
 */

export interface Template {
  name: string
  content: string
  frontmatter: TemplateFrontmatter
}

export interface TemplateFrontmatter {
  name: string
  description?: string
  category?: string
  allowedTools?: string[]
  validation?: ValidationRule[]
}

export interface ValidationRule {
  type: string
  field?: string
  message?: string
}
