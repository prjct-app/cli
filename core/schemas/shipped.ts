/**
 * Shipped Schema
 *
 * Defines the structure for shipped.json - completed/shipped items.
 */

export interface ShippedItemSchema {
  id: string
  description: string
  featureId?: string
  duration: string
  shippedAt: string // ISO8601
  commitHash?: string
}

export type ShippedSchema = ShippedItemSchema[]
