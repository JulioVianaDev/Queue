/**
 * Example usage of QueueEventEmitterService
 * 
 * This file demonstrates how to use the queue-based event system.
 * Events are emitted via QueueEventEmitterService, and listeners
 * automatically consume these events and add jobs to queues.
 * 
 * Architecture:
 * - QueueEventEmitterService emits events (no direct queue access)
 * - Listeners (MessageQueueListener, ImportationQueueListener, etc.)
 *   consume events and add jobs to queues
 */

import { Injectable } from '@nestjs/common';
import { QueueEventEmitterService } from '../queue/services/queue-event-emitter.service';

@Injectable()
export class QueueUsageExample {
  constructor(
    private readonly queueEventEmitter: QueueEventEmitterService,
  ) { }

  /**
   * Example: Use generic emit method (like event-emitter2)
   */
  useGenericEmit() {
    // Emit to message queue
    this.queueEventEmitter.emit('message', {
      groupId: 'inst1:cust1',
      instanceId: 'inst1',
      customerId: 'cust1',
      message: {
        type: 'text',
        message: 'Hello from generic emit!',
      },
    });

    // Emit to importations queue
    this.queueEventEmitter.emit('importations', {
      groupId: 'inst1',
      instanceId: 'inst1',
      importType: 'json',
      fileUrl: 'https://example.com/data.json',
    });
  }

  /**
   * Example: Emit multiple events at once
   */
  emitMultipleEvents() {
    this.queueEventEmitter.emitMany([
      {
        type: 'message',
        payload: {
          instanceId: 'inst1',
          customerId: 'cust1',
          message: {
            type: 'text',
            message: 'First message',
          },
        },
      },
      {
        type: 'message',
        payload: {
          instanceId: 'inst1',
          customerId: 'cust2',
          message: {
            type: 'text',
            message: 'Second message',
          },
        },
      },
      {
        type: 'importations',
        payload: {
          instanceId: 'inst1',
          importType: 'csv',
          fileUrl: 'https://example.com/file.csv',
        },
      },
    ]);
  }
}
