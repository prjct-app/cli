/**
 * Serializers Index
 *
 * MD-First Architecture: These serializers convert between TypeScript schemas and MD format.
 */

// State (now.md)
export {
  parseState,
  serializeState,
  createCurrentTaskMd,
  createEmptyStateMd
} from './state-serializer'

// Queue (next.md)
export {
  parseQueue,
  serializeQueue,
  createEmptyQueueMd
} from './queue-serializer'

// Shipped (shipped.md)
export {
  parseShipped,
  serializeShipped,
  createEmptyShippedMd
} from './shipped-serializer'
export type { ShippedFeature } from './shipped-serializer'

// Ideas (ideas.md)
export {
  parseIdeas,
  serializeIdeas,
  createEmptyIdeasMd
} from './ideas-serializer'
export type { Idea, IdeaStatus, IdeaPriority } from './ideas-serializer'
