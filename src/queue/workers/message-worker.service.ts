import { Injectable } from '@nestjs/common';
import { BaseWorkerService } from './base-worker.service';
import { QueueManagerService } from '../services/queue-manager.service';
import { MessageQueuePayload } from '../../types/queue.types';
import { PrismaService } from '../../prisma/prisma.service';
import { wait } from '../helpers/wait.helper';

/**
 * Worker service for processing message queue jobs
 * Only instantiated when message jobs need to be processed
 */
@Injectable()
export class MessageWorkerService extends BaseWorkerService {
  constructor(
    queueManager: QueueManagerService,
    private readonly prisma: PrismaService,
  ) {
    super(queueManager, 'message', MessageWorkerService.name);
    console.log('📨 [MessageWorkerService] Constructor called - Service instantiated!');
  }

  async processJob(job: {
    id: string;
    groupId: string;
    data: MessageQueuePayload;
  }): Promise<void> {
    const data = job.data;
    const timeoutMs = data.timeout;

    console.log('📨 [MessageWorkerService] processJob called!', {
      jobId: job.id,
      groupId: job.groupId,
      instanceId: data.instanceId,
      customerId: data.customerId,
      messageType: data.message?.type,
      timeoutMs: timeoutMs ?? 'none',
    });

    this.logger.log(
      `Processing message job ${job.id} for group ${job.groupId} - Instance: ${data.instanceId}, Customer: ${data.customerId}`,
    );
    const time = Date.now();

    // Timeout behavior: wait(timeoutMs) truncates the queue for this group for X time
    // (only one job per group runs at a time, so the next job waits until this one finishes)
    if (timeoutMs != null && timeoutMs > 0) {
      this.logger.log(
        `[MessageWorkerService] Job ${job.id} waiting ${timeoutMs}ms (timeout) before processing...`,
      );
      await wait(timeoutMs);
      this.logger.log(
        `[MessageWorkerService] Job ${job.id} finished waiting, processing message.`,
      );
    }
    // Add your message processing logic here
    await this.handleMessage(data, job.id, time);
  }

  /**
   * Handle the message processing
   * Saves message to database to verify processing order
   */
  protected async handleMessage(data: MessageQueuePayload, jobId: string, time: number): Promise<void> {
    console.log('📨 [MessageWorkerService] handleMessage called!', {
      jobId,
      instanceId: data.instanceId,
      customerId: data.customerId,
      message: data.message,
    });

    this.logger.debug(
      `Handling message for instance ${data.instanceId}, customer ${data.customerId}`,
    );

    try {
      // Save message to database to track processing order (jobSendedAt vs processedAt for timeout checks; processPid = Nest PID)
      const processedMessage = await this.prisma.processedMessage.create({
        data: {
          jobId: jobId,
          groupId: data.groupId,
          instanceId: data.instanceId,
          customerId: data.customerId,
          messageType: data.message?.type || 'unknown',
          messageData: data.message as any,
          jobSendedAt: data.jobSendedAt != null ? new Date(data.jobSendedAt) : undefined,
          processPid: process.pid,
          processedAt: new Date(time),
        },
      });

      console.log('💾 [MessageWorkerService] Message saved to database!', {
        id: processedMessage.id,
        jobId: processedMessage.jobId,
        groupId: processedMessage.groupId,
        jobSendedAt: processedMessage.jobSendedAt,
        processPid: processedMessage.processPid,
        processedAt: processedMessage.processedAt,
      });

      this.logger.log(
        `Message saved to database: ${processedMessage.id} (groupId: ${processedMessage.groupId})`,
      );

      // Simulate message processing (e.g., sending to external service)
      // await yourMessageService.send(data);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log('📨 [MessageWorkerService] Message processing completed!', {
        instanceId: data.instanceId,
        customerId: data.customerId,
        dbId: processedMessage.id,
      });
    } catch (error) {
      this.logger.error(
        `Error saving message to database: ${error.message}`,
        error.stack,
      );
      console.error('❌ [MessageWorkerService] Database error:', error);
      throw error;
    }
  }
}
