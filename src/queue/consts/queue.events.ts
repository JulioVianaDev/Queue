/**
 * Queue event names constants
 * These events are emitted by QueueEventEmitterService
 * and consumed by queue listeners
 */
export const QUEUE_EVENTS = {
  /**
   * Generic event for adding jobs to any queue
   * Payload should contain: { queueType, data, options? }
   */
  ADD_JOB: 'queue.add.job',
} as const;
