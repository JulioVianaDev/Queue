import { Injectable, OnModuleInit } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardGroupMQAdapter } from 'groupmq';
import { QueueManagerService } from './queue-manager.service';
import * as express from 'express';

@Injectable()
export class DashboardService implements OnModuleInit {
  private serverAdapter: ExpressAdapter;

  constructor(private readonly queueManager: QueueManagerService) {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');
  }

  onModuleInit() {
    // Get all queues from queue manager
    const allQueues = this.queueManager.getAllQueues();

    // Create adapters for each queue
    // Using 'any' for the type parameter since different queues have different payload types
    const queueAdapters = Array.from(allQueues.entries()).map(([queueType, queue]) => {
      const displayName = this.getDisplayName(queueType);
      return new BullBoardGroupMQAdapter<any>(queue, {
        displayName,
      });
    });

    // Create Bull Board with all queues
    createBullBoard({
      queues: queueAdapters,
      serverAdapter: this.serverAdapter,
    });
  }

  /**
   * Get display name for queue type
   */
  private getDisplayName(queueType: string): string {
    const names: Record<string, string> = {
      message: 'Message Queue',
      importations: 'Importations Queue',
      exportations: 'Exportations Queue',
    };
    return names[queueType] || `${queueType} Queue`;
  }

  /**
   * Get the Express router for the dashboard
   */
  getRouter(): express.Router {
    return this.serverAdapter.getRouter();
  }

  /**
   * Get the base path
   */
  getBasePath(): string {
    return '/admin/queues';
  }
}
