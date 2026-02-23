import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  QueueType,
  QueueEventOptions,
  MessageQueuePayload,
  ImportationQueuePayload,
  ExportationQueuePayload,
} from '../../types/queue.types';
import { MessageQueueData } from '../../types/messages.type';
import { QUEUE_EVENTS } from '../consts/queue.events';
import { QueueEventPayload } from '../listeners/queue.listener';

/**
 * Event emitter service that emits events
 * Listeners will consume these events and add jobs to queues
 * This service doesn't have direct access to queues
 */
@Injectable()
export class QueueEventEmitterService {
  constructor(private readonly eventEmitter: EventEmitter2) { }

  /**
   * Emit an event to a queue (like eventEmitter.emit())
   * The event will be consumed by a listener that adds jobs to queues
   * 
   * @example
   * // For message queue
   * queueEventEmitter.emit('message', {
   *   instanceId: 'inst1',
   *   customerId: 'cust1',
   *   message: { type: 'text', message: 'Hello' }
   * });
   * 
   * @example
   * // For importations queue
   * queueEventEmitter.emit('importations', {
   *   instanceId: 'inst1',
   *   importType: 'csv',
   *   fileUrl: 'https://example.com/file.csv'
   * });
   */
  emit<T extends QueueType>(
    queueType: T,
    payload: T extends 'message'
      ? MessageQueueData | MessageQueuePayload
      : T extends 'importations'
      ? Omit<ImportationQueuePayload, 'groupId'>
      : T extends 'exportations'
      ? Omit<ExportationQueuePayload, 'groupId'>
      : never,
    options?: QueueEventOptions,
  ): boolean {
    console.log('🚀 [QueueEventEmitter] Emitting event!', {
      queueType,
      eventName: QUEUE_EVENTS.ADD_JOB,
      hasPayload: !!payload,
      hasOptions: !!options,
    });

    const result = this.eventEmitter.emit(QUEUE_EVENTS.ADD_JOB, {
      queueType,
      data: payload,
      options,
    } as QueueEventPayload);

    console.log('✅ [QueueEventEmitter] Event emitted!', {
      queueType,
      listenersCalled: result,
    });

    return result;
  }

  /**
   * Emit multiple events at once (like eventEmitter.emit() with multiple listeners)
   * 
   * @example
   * queueEventEmitter.emitMany([
   *   { type: 'message', payload: {...}, options: {...} },
   *   { type: 'importations', payload: {...} }
   * ]);
   */
  emitMany(
    events: Array<{
      type: QueueType;
      payload:
      | MessageQueueData
      | MessageQueuePayload
      | Omit<ImportationQueuePayload, 'groupId'>
      | Omit<ExportationQueuePayload, 'groupId'>;
      options?: QueueEventOptions;
    }>,
  ): boolean[] {
    return events.map((event) =>
      this.emit(event.type, event.payload as any, event.options),
    );
  }
}
