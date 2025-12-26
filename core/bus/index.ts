/**
 * EventBus - Lightweight Pub/Sub System for prjct-cli
 *
 * Barrel export for bus module
 */

export { EventBus, eventBus, emit, default } from './bus'
export { EventTypes, type EventType, type EventData, type EventCallback } from './bus.types'
