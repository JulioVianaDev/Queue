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

// Close workers immediately on shutdown so in‑flight jobs stay in Redis as processing.
// GroupMQ's built‑in stalled detection will then requeue them on the next instance.
const SHUTDOWN_CLOSE_MS = 0;

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

    // After workers are created, ensure that all waiting message jobs have their
    // groups present in the internal "ready" set so they can actually be reserved
    // after multiple PM2 reloads (no jobs stuck forever in "waiting"/"Em espera").
    await this.ensureWaitingMessageGroupsReady();

    this.logger.log(
      `All workers started (Instance: ${instanceId})`,
    );
  }

  async onModuleDestroy() {
    this.logger.log(
      'Stopping all workers gracefully so in-flight jobs can finish or be marked stalled by GroupMQ...',
    );

    const closePromises = Array.from(this.workers.values()).map((worker) =>
      worker.close(),
    );

    await Promise.all(closePromises);
    this.logger.log('All workers stopped');
  }

  /**
   * Initialize a worker for a specific queue type
   * Uses lazy loading - worker service is only instantiated when a job is processed
   */
  private async initializeWorker(queueType: QueueType, instanceId: string | number) {
    const queue = this.queueManager.getQueue(queueType);
    const config = this.queueManager.getQueueConfig(queueType);

    const workerName = `${queueType}-worker-${instanceId}`;

    const isMessageQueue = queueType === 'message';
    const worker = new Worker<any>({
      queue,
      name: workerName,
      concurrency: config.maxConcurrency,
      // For the message queue, let GroupMQ handle stalls forever:
      // - maxStalledCount: 0  => never fail due to stalling (infinite stalled retries)
      // - stalledInterval: 10s => check regularly for crashed workers
      // Business timeout is handled in MessageWorkerService using data.startAt + data.timeout.
      ...(isMessageQueue && {
        maxStalledCount: 0,
        stalledInterval: 10_000,
        stalledGracePeriod: 0,
      }),
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

  /**
   * On startup, scan waiting jobs in the message queue and make sure their groups
  * are in the "ready" set so the workers can pick them up. Also fixes poisoned
  * groups where GroupMQ repeatedly logs "Blocking found group but reserve failed"
  * by forcing a safe retry of non-processing jobs.
   */
  private async ensureWaitingMessageGroupsReady(): Promise<void> {
    try {
      const queue = this.queueManager.getQueue('message') as any;
      if (!queue || typeof queue.getJobsByStatus !== 'function') {
        console.log("queue or getJobsByStatus is not defined", queue);
        return;
      }

      const redis = queue.redis as any;
      const ns: string | undefined = queue.namespace;
      if (!redis || !ns) {
        console.log("redis or ns is not defined", redis, ns);
        return;
      }

      const waitingJobs: any[] = await queue.getJobsByStatus(['waiting']);
      console.log("waitingJobs", JSON.stringify(waitingJobs, null, 2));
      if (!waitingJobs || waitingJobs.length === 0) {
        return;
      }

      const readyKey = `${ns}:ready`;
      const groupsKey = `${ns}:groups`;

      for (const job of waitingJobs) {
        const groupId: string | undefined = job.groupId;
        if (!groupId) continue;

        // Use orderMs if available, otherwise fall back to timestamp or "now" as score.
        const score =
          (job.orderMs as number | undefined) ??
          (job.timestamp as number | undefined) ??
          Date.now();

        await redis.zadd(readyKey, score, groupId);
        await redis.sadd(groupsKey, groupId);

        // If GroupMQ keeps logging "Blocking found group but reserve failed"
        // for this group, the safest app‑level recovery is:
        // - dead‑letter the poisoned job (so it is visible as failed)
        // - re‑enqueue the same payload as a fresh job in the same group.
        // This clears any internal inconsistent state that prevents reserveAtomic.
        try {
          if (typeof queue.isJobProcessing === 'function') {
            const processing = await queue.isJobProcessing(job.id);
            if (!processing) {
              const jobId = job.id;

              // Move old job to dead‑letter for inspection
              if (typeof queue.deadLetter === 'function') {
                await queue.deadLetter(jobId, groupId);
              }

              // Re‑add with the same data and ordering so business timeout
              // logic based on startedAt/needFinishedAt still holds.
              if (typeof queue.add === 'function') {
                await queue.add({
                  groupId,
                  data: job.data,
                  orderMs: job.orderMs ?? job.timestamp ?? Date.now(),
                });
              }

              this.logger.warn(
                `[WorkerService] Detected poisoned waiting job ${jobId} in group ${groupId} and recreated it as a fresh job to recover from reserve failures.`,
              );
            }
          }
        } catch (recreateErr) {
          this.logger.warn(
            `[WorkerService] Failed to recover poisoned waiting job ${job.id} in group ${groupId}: ${(recreateErr as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `[WorkerService] Failed to ensure waiting message groups are ready on startup: ${(err as Error).message}`,
      );
    }
  }
}
