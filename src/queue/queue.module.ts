import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { QueueService } from './services/queue.service';
import { QueueManagerService } from './services/queue-manager.service';
import { QueueEventEmitterService } from './services/queue-event-emitter.service';
import { WorkerService } from './services/worker.service';
import { DashboardService } from './services/dashboard.service';
import { QueueListener } from './listeners/queue.listener';
// Worker services (lazy loaded - only instantiated when needed)
import { MessageWorkerService } from './workers/message-worker.service';
import { ImportationWorkerService } from './workers/importation-worker.service';
import { ExportationWorkerService } from './workers/exportation-worker.service';
import { WorkerServiceFactory } from './workers/worker-service.factory';
import { QueueController } from './controllers/queue.controller';

@Global()
@Module({
  controllers: [QueueController],
  imports: [
    EventEmitterModule.forRoot({
      // Configuration options for EventEmitter2
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
  ],
  providers: [
    QueueService, // Keep for backward compatibility
    QueueManagerService,
    QueueEventEmitterService,
    WorkerService,
    DashboardService,
    // Generic queue event listener
    QueueListener,
    // Worker service factory (for lazy loading)
    WorkerServiceFactory,
    // Worker services (registered but only instantiated when needed)
    MessageWorkerService,
    ImportationWorkerService,
    ExportationWorkerService,
  ],
  exports: [
    QueueService, // Keep for backward compatibility
    QueueManagerService,
    QueueEventEmitterService,
    WorkerService,
    DashboardService,
    EventEmitterModule,
    // Export worker services so they can be used directly if needed
    MessageWorkerService,
    ImportationWorkerService,
    ExportationWorkerService,
  ],
})
export class QueueModule { }

