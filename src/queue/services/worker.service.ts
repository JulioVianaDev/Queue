import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Worker } from 'groupmq';
import { QueueManagerService } from './queue-manager.service';
import { WorkerServiceFactory } from '../workers/worker-service.factory';
import { QueueType, QueuePayload } from '../../types/queue.types';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private workers: Map<QueueType, Worker<any>> = new Map();

  constructor(
    private readonly queueManager: QueueManagerService,
    private readonly workerServiceFactory: WorkerServiceFactory,
  ) { }

  async onModuleInit() {
    const instanceId = process.env.pm_id || process.pid;

    // Initialize workers for all queue types
    const queueTypes: QueueType[] = ['message', 'importations', 'exportations'];

    for (const queueType of queueTypes) {
      await this.initializeWorker(queueType, instanceId);
    }

    this.logger.log(
      `All workers started (Instance: ${instanceId})`,
    );
  }

  async onModuleDestroy() {
    this.logger.log('Stopping all workers gracefully...');

    // Close all workers
    const closePromises = Array.from(this.workers.values()).map((worker) =>
      worker.close(30000), // 30 seconds grace period
    );

    await Promise.all(closePromises);
    this.logger.log('All workers stopped gracefully');
  }

  /**
   * Initialize a worker for a specific queue type
   * Uses lazy loading - worker service is only instantiated when a job is processed
   */
  private async initializeWorker(queueType: QueueType, instanceId: string | number) {
    const queue = this.queueManager.getQueue(queueType);
    const config = this.queueManager.getQueueConfig(queueType);

    const workerName = `${queueType}-worker-${instanceId}`;

    const worker = new Worker<any>({
      queue,
      name: workerName,
      concurrency: config.maxConcurrency,
      handler: async (job) => {
        // Lazy load: Get or create the worker service only when processing a job
        const workerService = this.workerServiceFactory.getWorkerService(queueType);

        // Process the job using the appropriate worker service
        await workerService.processJob(job);
      },
    });

    // Start the worker
    worker.run();

    // Listen to worker events
    worker.on('completed', (job) => {
      this.logger.log(
        `[${queueType}] Job ${job.id} completed for group ${job.groupId}`,
      );
    });

    worker.on('failed', (job) => {
      this.logger.error(
        `[${queueType}] Job ${job.id} failed for group ${job.groupId}`,
      );
    });

    worker.on('error', (error) => {
      this.logger.error(`[${queueType}] Worker error: ${error.message}`);
    });

    this.workers.set(queueType, worker);
    this.logger.log(
      `Worker "${workerName}" started for queue "${queueType}" with concurrency ${config.maxConcurrency}`,
    );
  }


  /**
   * Get worker instance for a specific queue type
   */
  getWorker(queueType: QueueType) {
    return this.workers.get(queueType);
  }

  /**
   * Get all workers
   */
  getAllWorkers(): Map<QueueType, Worker<any>> {
    return this.workers;
  }

  /**
   * Get list of instantiated worker services (for monitoring)
   * Shows which worker services have been lazy-loaded
   */
  getInstantiatedWorkerServices(): QueueType[] {
    return this.workerServiceFactory.getInstantiatedServices();
  }
}
