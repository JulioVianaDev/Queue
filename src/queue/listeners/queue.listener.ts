import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { QueueManagerService } from '../services/queue-manager.service';
import { QUEUE_EVENTS } from '../consts/queue.events';
import {
  QueueType,
  QueuePayload,
  QueueEventOptions,
  MessageQueuePayload,
  ImportationQueuePayload,
  ExportationQueuePayload,
} from '../../types/queue.types';
import { MessageQueueData } from '../../types/messages.type';

/**
 * Generic event payload for queue events
 * Contains queue type and payload data
 */
export interface QueueEventPayload {
  queueType: QueueType;
  data: any; // The actual payload data
  options?: QueueEventOptions;
}

/**
 * Task queue item for sequential processing
 */
interface QueuedTask {
  payload: QueueEventPayload;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

@Injectable()
export class QueueListener {
  private readonly logger = new Logger(QueueListener.name);
  // Processing queues per queue type to ensure sequential processing
  private readonly processingQueues: Map<QueueType, QueuedTask[]> = new Map();
  private readonly processingFlags: Map<QueueType, boolean> = new Map();

  constructor(private readonly queueManager: QueueManagerService) {
    // Initialize processing queues for each queue type
    const queueTypes: QueueType[] = ['message', 'importations', 'exportations'];
    queueTypes.forEach((type) => {
      this.processingQueues.set(type, []);
      this.processingFlags.set(type, false);
    });
  }

  @OnEvent(QUEUE_EVENTS.ADD_JOB)
  async handleQueueEvent(payload: QueueEventPayload): Promise<any> {
    console.log('🎯 [QueueListener] Event received!', {
      queueType: payload.queueType,
      hasData: !!payload.data,
      hasOptions: !!payload.options,
    });

    this.logger.debug(
      `Queue event received for type "${payload.queueType}", adding to processing queue.`,
    );

    // Queue the event for sequential processing
    return new Promise((resolve, reject) => {
      const queue = this.processingQueues.get(payload.queueType);
      if (!queue) {
        reject(new Error(`No processing queue found for type "${payload.queueType}"`));
        return;
      }

      queue.push({ payload, resolve, reject });
      this.processQueue(payload.queueType);
    });
  }

  /**
   * Process events from the queue sequentially
   * Ensures that events for the same queue type are processed one at a time
   */
  private async processQueue(queueType: QueueType): Promise<void> {
    // If already processing, wait for current processing to finish
    if (this.processingFlags.get(queueType)) {
      return;
    }

    const queue = this.processingQueues.get(queueType);
    if (!queue || queue.length === 0) {
      return;
    }

    // Mark as processing
    this.processingFlags.set(queueType, true);

    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) {
        break;
      }

      try {
        const result = await this.processEvent(task.payload);
        task.resolve(result);
      } catch (error) {
        task.reject(error);
      }
    }

    // Mark as not processing
    this.processingFlags.set(queueType, false);
  }

  /**
   * Process a single event (actual job addition logic)
   */
  private async processEvent(payload: QueueEventPayload): Promise<any> {
    try {
      const { queueType, data, options } = payload;

      // Generate groupId if not provided
      let groupId = options?.groupId;

      if (!groupId) {
        // Auto-generate groupId based on queue type and data structure
        if (queueType === 'message') {
          // For messages: instanceId:customerId
          if (data.instanceId && data.customerId) {
            groupId = `${data.instanceId}:${data.customerId}`;
          } else if ('groupId' in data && data.groupId) {
            groupId = data.groupId;
          }
        } else if (queueType === 'importations' || queueType === 'exportations') {
          // For importations/exportations: instanceId:customerId or just instanceId
          if (data.instanceId && data.customerId) {
            groupId = `${data.instanceId}:${data.customerId}`;
          } else if (data.instanceId) {
            groupId = data.instanceId;
          } else if ('groupId' in data && data.groupId) {
            groupId = data.groupId;
          }
        }

        if (!groupId) {
          throw new Error(
            `groupId is required for queue "${queueType}". Provide it in options or ensure data has instanceId (and optionally customerId).`,
          );
        }
      }

      // Prepare payload with groupId
      const queuePayload: QueuePayload<QueueType> = {
        groupId,
        ...data,
      } as QueuePayload<QueueType>;

      // Add job to queue using the generic addJob method
      console.log(`📝 [QueueListener] Adding job to "${queueType}" queue...`, { groupId });
      const job = await this.queueManager.addJob(queueType, queuePayload, options);

      console.log(`✅ [QueueListener] Job added successfully!`, {
        queueType,
        jobId: job.id,
        groupId,
      });

      this.logger.log(
        `Job added to "${queueType}" queue: ${job.id} (groupId: ${groupId})`,
      );

      return job;
    } catch (error) {
      this.logger.error(
        `Error adding job to "${payload.queueType}" queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
