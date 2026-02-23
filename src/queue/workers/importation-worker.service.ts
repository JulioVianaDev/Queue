import { Injectable } from '@nestjs/common';
import { BaseWorkerService } from './base-worker.service';
import { QueueManagerService } from '../services/queue-manager.service';
import { ImportationQueuePayload } from '../../types/queue.types';

/**
 * Worker service for processing importation queue jobs
 * Only instantiated when importation jobs need to be processed
 */
@Injectable()
export class ImportationWorkerService extends BaseWorkerService {
  constructor(queueManager: QueueManagerService) {
    super(queueManager, 'importations', ImportationWorkerService.name);
    console.log('📥 [ImportationWorkerService] Constructor called - Service instantiated!');
  }

  async processJob(job: {
    id: string;
    groupId: string;
    data: ImportationQueuePayload;
  }): Promise<void> {
    const data = job.data;
    console.log('📥 [ImportationWorkerService] processJob called!', {
      jobId: job.id,
      groupId: job.groupId,
      instanceId: data.instanceId,
      importType: data.importType,
      fileUrl: data.fileUrl,
    });

    this.logger.log(
      `Processing importation job ${job.id} for group ${job.groupId} - Instance: ${data.instanceId}, Type: ${data.importType}`,
    );

    // Add your importation processing logic here
    await this.handleImportation(data);
  }

  /**
   * Handle the importation processing
   * Override this method with your business logic
   */
  protected async handleImportation(data: ImportationQueuePayload): Promise<void> {
    console.log('📥 [ImportationWorkerService] handleImportation called!', {
      instanceId: data.instanceId,
      importType: data.importType,
      fileUrl: data.fileUrl,
      options: data.options,
    });

    this.logger.debug(
      `Handling importation for instance ${data.instanceId}, type ${data.importType}`,
    );
    // Example: Process the importation
    // await yourImportService.process(data);
    // For now, just simulate processing
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('📥 [ImportationWorkerService] Importation processing completed!', {
      instanceId: data.instanceId,
      importType: data.importType,
    });
  }
}
