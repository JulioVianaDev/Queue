import { Injectable } from '@nestjs/common';
import { BaseWorkerService } from './base-worker.service';
import { QueueManagerService } from '../services/queue-manager.service';
import { MessageQueuePayload } from '../../types/queue.types';
import { PrismaService } from '../../prisma/prisma.service';

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
    console.log('📨 [MessageWorkerService] processJob called!', {
      jobId: job.id,
      groupId: job.groupId,
      instanceId: data.instanceId,
      customerId: data.customerId,
      messageType: data.message?.type,
    });

    this.logger.log(
      `Processing message job ${job.id} for group ${job.groupId} - Instance: ${data.instanceId}, Customer: ${data.customerId}`,
    );

    // Add your message processing logic here
    await this.handleMessage(data, job.id);
  }

  /**
   * Handle the message processing
   * Saves message to database to verify processing order
   */
  protected async handleMessage(data: MessageQueuePayload, jobId: string): Promise<void> {
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
      // Save message to database to track processing order
      const processedMessage = await this.prisma.processedMessage.create({
        data: {
          jobId: jobId,
          groupId: data.groupId,
          instanceId: data.instanceId,
          customerId: data.customerId,
          messageType: data.message?.type || 'unknown',
          messageData: data.message as any,
          processedAt: new Date(),
        },
      });

      console.log('💾 [MessageWorkerService] Message saved to database!', {
        id: processedMessage.id,
        jobId: processedMessage.jobId,
        groupId: processedMessage.groupId,
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
