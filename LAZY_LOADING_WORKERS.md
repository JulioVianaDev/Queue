# Lazy Loading Worker Services

This document explains the lazy loading architecture for worker services.

## Overview

Worker services are **only instantiated when needed** (when a job is actually processed), not at application startup. This improves performance by:

- Reducing initial memory footprint
- Only loading services that are actually used
- Faster application startup time

## Architecture

### Components

1. **BaseWorkerService** (`src/queue/workers/base-worker.service.ts`)
   - Abstract base class for all worker services
   - Defines the `processJob()` method that must be implemented

2. **Worker Services** (one per queue type)
   - `MessageWorkerService` - Handles message queue jobs
   - `ImportationWorkerService` - Handles importation queue jobs
   - `ExportationWorkerService` - Handles exportation queue jobs

3. **WorkerServiceFactory** (`src/queue/workers/worker-service.factory.ts`)
   - Manages lazy loading of worker services
   - Only creates service instances when first needed
   - Caches instances for reuse

4. **WorkerService** (`src/queue/worker.service.ts`)
   - Manages GroupMQ workers
   - Uses factory to get worker services on-demand

## How It Works

### 1. Application Startup

```typescript
// Workers are created for all queue types
// BUT worker services are NOT instantiated yet
WorkerService.onModuleInit() {
  // Creates GroupMQ workers
  // Worker handlers use lazy loading
}
```

### 2. Job Processing (Lazy Loading)

```typescript
// When a job arrives:
worker.handler = async (job) => {
  // Lazy load: Get or create service only now
  const workerService = factory.getWorkerService('message');
  
  // Process job
  await workerService.processJob(job);
}
```

### 3. Service Caching

Once a service is instantiated, it's cached and reused:

```typescript
// First call: Creates and caches service
factory.getWorkerService('message'); // Creates MessageWorkerService

// Subsequent calls: Returns cached instance
factory.getWorkerService('message'); // Returns existing instance
```

## Example Usage

### Custom Worker Service

```typescript
import { Injectable } from '@nestjs/common';
import { BaseWorkerService } from './base-worker.service';
import { QueueManagerService } from '../queue-manager.service';
import { MessageQueuePayload } from '../../types/queue.types';

@Injectable()
export class MessageWorkerService extends BaseWorkerService {
  constructor(queueManager: QueueManagerService) {
    super(queueManager, 'message', MessageWorkerService.name);
  }

  async processJob(job: {
    id: string;
    groupId: string;
    data: MessageQueuePayload;
  }): Promise<void> {
    const data = job.data;
    
    // Your business logic here
    await this.handleMessage(data);
  }

  protected async handleMessage(data: MessageQueuePayload): Promise<void> {
    // Process the message
    // await yourMessageService.send(data);
  }
}
```

### Monitoring Instantiated Services

```typescript
// Check which services have been loaded
const instantiated = workerService.getInstantiatedWorkerServices();
// Returns: ['message'] if only message service has been used
```

## Benefits

1. **Memory Efficiency**: Services only loaded when needed
2. **Performance**: Faster startup, less initial overhead
3. **Scalability**: Can handle many queue types without loading all services
4. **Flexibility**: Easy to add new worker services without affecting existing ones

## When Services Are Loaded

- **NOT loaded** at application startup
- **Loaded** when first job of that type is processed
- **Cached** for subsequent jobs
- **Shared** across all workers of the same type

## Adding New Queue Types

1. Create worker service extending `BaseWorkerService`
2. Register in `WorkerServiceFactory.serviceClasses`
3. Add to `QueueModule.providers`
4. Service will be lazy-loaded automatically!
