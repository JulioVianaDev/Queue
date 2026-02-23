import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { QueueType } from '../../types/queue.types';
import { BaseWorkerService } from './base-worker.service';
import { MessageWorkerService } from './message-worker.service';
import { ImportationWorkerService } from './importation-worker.service';
import { ExportationWorkerService } from './exportation-worker.service';

/**
 * Factory for lazy loading worker services
 * Services are only instantiated when needed (when jobs are processed)
 */
@Injectable()
export class WorkerServiceFactory {
  private serviceInstances: Map<QueueType, BaseWorkerService> = new Map();
  private serviceClasses: Map<QueueType, Type<BaseWorkerService>> = new Map();

  constructor(private readonly moduleRef: ModuleRef) {
    // Map queue types to their service classes
    this.serviceClasses.set('message', MessageWorkerService);
    this.serviceClasses.set('importations', ImportationWorkerService);
    this.serviceClasses.set('exportations', ExportationWorkerService);
  }

  /**
   * Get or create a worker service for a specific queue type
   * Uses lazy loading - service is only created when first needed
   */
  getWorkerService(queueType: QueueType): BaseWorkerService {
    // Return existing instance if already created
    if (this.serviceInstances.has(queueType)) {
      console.log(`⚡ [WorkerServiceFactory] Returning cached instance for: ${queueType}`);
      return this.serviceInstances.get(queueType)!;
    }

    console.log(`🔄 [WorkerServiceFactory] LAZY LOADING service for: ${queueType}`);

    // Get the service class for this queue type
    const ServiceClass = this.serviceClasses.get(queueType);
    if (!ServiceClass) {
      throw new Error(`No worker service found for queue type: ${queueType}`);
    }

    // Lazy load: create the service instance only when needed
    const service = this.moduleRef.get(ServiceClass, { strict: false });
    this.serviceInstances.set(queueType, service);

    console.log(`✅ [WorkerServiceFactory] Service loaded and cached: ${queueType}`);
    console.log(`📊 [WorkerServiceFactory] Currently instantiated services:`, Array.from(this.serviceInstances.keys()));

    return service;
  }

  /**
   * Check if a service has been instantiated
   */
  hasService(queueType: QueueType): boolean {
    return this.serviceInstances.has(queueType);
  }

  /**
   * Get all instantiated services (for monitoring/debugging)
   */
  getInstantiatedServices(): QueueType[] {
    return Array.from(this.serviceInstances.keys());
  }
}
