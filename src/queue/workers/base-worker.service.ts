import { Logger } from '@nestjs/common';
import { QueueManagerService } from '../services/queue-manager.service';
import { QueueType, QueuePayload } from '../../types/queue.types';

/**
 * Base abstract class for queue worker services
 * Each queue type should extend this class
 */
export abstract class BaseWorkerService {
  protected readonly logger: Logger;
  protected readonly queueManager: QueueManagerService;
  protected readonly queueType: QueueType;

  constructor(
    queueManager: QueueManagerService,
    queueType: QueueType,
    loggerName: string,
  ) {
    this.queueManager = queueManager;
    this.queueType = queueType;
    this.logger = new Logger(loggerName);
  }

  /**
   * Process a job from the queue
   * This method is called by the worker when a job is available
   */
  abstract processJob(job: {
    id: string;
    groupId: string;
    data: QueuePayload<QueueType>;
  }): Promise<void>;

  /**
   * Get the queue type this worker handles
   */
  getQueueType(): QueueType {
    return this.queueType;
  }
}
