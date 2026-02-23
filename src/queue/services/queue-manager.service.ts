import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Queue } from 'groupmq';
import Redis from 'ioredis';
import {
  QueueType,
  QueuePayload,
  QueueConfig,
  QueueEventOptions,
} from '../../types/queue.types';

@Injectable()
export class QueueManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueManagerService.name);
  private redis: Redis;
  private queues: Map<QueueType, Queue<any>> = new Map();
  private queueConfigs: Map<QueueType, QueueConfig> = new Map();

  constructor() {
    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6400'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    // Initialize queue configurations
    this.initializeQueueConfigs();
  }

  async onModuleInit() {
    const instanceId = process.env.pm_id || process.pid;
    this.logger.log(`QueueManager initialized (Instance: ${instanceId})`);

    // Initialize all queues
    for (const [queueType, config] of this.queueConfigs.entries()) {
      await this.initializeQueue(queueType, config);
    }
  }

  async onModuleDestroy() {
    // Close all queues
    for (const queue of this.queues.values()) {
      // Queues don't have a close method, but we can close Redis
    }
    // Close Redis connection
    await this.redis.quit();
    this.logger.log('QueueManager destroyed');
  }

  /**
   * Initialize queue configurations from environment or defaults
   */
  private initializeQueueConfigs() {
    const defaultConfigs: QueueConfig[] = [
      {
        name: 'message',
        namespace: 'message',
        maxConcurrency: parseInt(process.env.MESSAGE_QUEUE_CONCURRENCY || '5'),
        keepCompleted: parseInt(process.env.KEEP_COMPLETED_JOBS || '1000'),
        keepFailed: parseInt(process.env.KEEP_FAILED_JOBS || '1000'),
      },
      {
        name: 'importations',
        namespace: 'importations',
        maxConcurrency: parseInt(process.env.IMPORTATIONS_QUEUE_CONCURRENCY || '3'),
        keepCompleted: parseInt(process.env.KEEP_COMPLETED_JOBS || '1000'),
        keepFailed: parseInt(process.env.KEEP_FAILED_JOBS || '1000'),
      },
      {
        name: 'exportations',
        namespace: 'exportations',
        maxConcurrency: parseInt(process.env.EXPORTATIONS_QUEUE_CONCURRENCY || '3'),
        keepCompleted: parseInt(process.env.KEEP_COMPLETED_JOBS || '1000'),
        keepFailed: parseInt(process.env.KEEP_FAILED_JOBS || '1000'),
      },
    ];

    for (const config of defaultConfigs) {
      this.queueConfigs.set(config.name, config);
    }
  }

  /**
   * Initialize a specific queue
   */
  private async initializeQueue(queueType: QueueType, config: QueueConfig) {
    const queue = new Queue<any>({
      redis: this.redis,
      namespace: config.namespace,
      keepCompleted: config.keepCompleted,
      keepFailed: config.keepFailed,
    });

    this.queues.set(queueType, queue);
    this.logger.log(
      `Queue "${config.namespace}" initialized with maxConcurrency: ${config.maxConcurrency}`,
    );
  }

  /**
   * Get a queue by type
   */
  getQueue<T extends QueueType>(queueType: T): Queue<QueuePayload<T>> {
    const queue = this.queues.get(queueType);
    if (!queue) {
      throw new Error(`Queue "${queueType}" not found`);
    }
    return queue as Queue<QueuePayload<T>>;
  }

  /**
   * Get queue configuration
   */
  getQueueConfig(queueType: QueueType): QueueConfig {
    const config = this.queueConfigs.get(queueType);
    if (!config) {
      throw new Error(`Queue config for "${queueType}" not found`);
    }
    return config;
  }

  /**
   * Get all queues (for dashboard)
   */
  getAllQueues(): Map<QueueType, Queue<any>> {
    return this.queues;
  }

  /**
   * Add a job to a specific queue
   */
  async addJob<T extends QueueType>(
    queueType: T,
    payload: QueuePayload<T>,
    options?: QueueEventOptions,
  ) {
    const queue = this.getQueue(queueType);
    const groupId = options?.groupId || payload.groupId;

    if (!groupId) {
      throw new Error(`groupId is required for queue "${queueType}"`);
    }

    return await queue.add({
      groupId,
      data: payload,
      orderMs: options?.orderMs || Date.now(),
      delay: options?.delay,
    });
  }

}
