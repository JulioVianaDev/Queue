import { Injectable } from '@nestjs/common';
import { BaseWorkerService } from './base-worker.service';
import { QueueManagerService } from '../services/queue-manager.service';
import { ExportationQueuePayload } from '../../types/queue.types';

/**
 * Worker service for processing exportation queue jobs
 * Only instantiated when exportation jobs need to be processed
 */
@Injectable()
export class ExportationWorkerService extends BaseWorkerService {
  constructor(queueManager: QueueManagerService) {
    super(queueManager, 'exportations', ExportationWorkerService.name);
    console.log('📤 [ExportationWorkerService] Constructor called - Service instantiated!');
  }

  async processJob(job: {
    id: string;
    groupId: string;
    data: ExportationQueuePayload;
  }): Promise<void> {
    const data = job.data;
    console.log('📤 [ExportationWorkerService] processJob called!', {
      jobId: job.id,
      groupId: job.groupId,
      instanceId: data.instanceId,
      exportType: data.exportType,
      format: data.format,
    });

    this.logger.log(
      `Processing exportation job ${job.id} for group ${job.groupId} - Instance: ${data.instanceId}, Type: ${data.exportType}`,
    );

    // Add your exportation processing logic here
    await this.handleExportation(data);
  }

  /**
   * Handle the exportation processing
   * Override this method with your business logic
   */
  protected async handleExportation(data: ExportationQueuePayload): Promise<void> {
    console.log('📤 [ExportationWorkerService] handleExportation called!', {
      instanceId: data.instanceId,
      exportType: data.exportType,
      format: data.format,
      filters: data.filters,
      options: data.options,
    });

    this.logger.debug(
      `Handling exportation for instance ${data.instanceId}, type ${data.exportType}`,
    );
    // Example: Process the exportation
    // await yourExportService.process(data);
    // For now, just simulate processing
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('📤 [ExportationWorkerService] Exportation processing completed!', {
      instanceId: data.instanceId,
      exportType: data.exportType,
    });
  }
}
