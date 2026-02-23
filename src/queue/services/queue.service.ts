import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'groupmq';
import Redis from 'ioredis';

export interface MensagemJobData {
  instanceId: string;
  customerId: string;
  message: any;
  [key: string]: any;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;
  public queue: Queue<MensagemJobData>;

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

    // Initialize the queue with namespace "mensagens"
    // Configure retention so completed jobs are visible in the dashboard
    this.queue = new Queue<MensagemJobData>({
      redis: this.redis,
      namespace: 'mensagens',
      keepCompleted: parseInt(process.env.KEEP_COMPLETED_JOBS || '1000'), // Keep last 1000 completed jobs for dashboard visibility
      keepFailed: parseInt(process.env.KEEP_FAILED_JOBS || '1000'), // Keep last 1000 failed jobs
    });
  }

  async onModuleInit() {
    // Queue is ready to use
    // Multiple instances can safely create Queue instances with the same namespace
    // They all connect to the same Redis backend and coordinate through Redis
    const instanceId = process.env.pm_id || process.pid;
    console.log(`Queue "mensagens" initialized (Instance: ${instanceId})`);
  }

  async onModuleDestroy() {
    // Close Redis connection
    await this.redis.quit();
  }

  /**
   * Add a job to the queue
   * Groups jobs by instanceId:customerId
   */
  async addJob(
    data: MensagemJobData,
    options?: { orderMs?: number; delay?: number },
  ) {
    const groupId = `${data.instanceId}:${data.customerId}`;

    return await this.queue.add({
      groupId,
      data,
      orderMs: options?.orderMs || Date.now(),
      delay: options?.delay,
    });
  }

  /**
   * Get queue instance for dashboard
   */
  getQueue() {
    return this.queue;
  }
}
