import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { QueueEventEmitterService } from 'src/queue/services/queue-event-emitter.service';
import { QueueManagerService } from 'src/queue/services/queue-manager.service';
import { QueueType } from 'src/types/queue.types';
import { MessageQueueData } from 'src/types/messages.type';


@Controller('queue')
export class QueueController {
  constructor(
    private readonly queueEventEmitter: QueueEventEmitterService,
    private readonly queueManager: QueueManagerService,
  ) { }

  /**
   * Add a job to a queue using event emitter API
   * POST /queue/:queueType
   *
   * Options: orderMs, delay, groupId, timeout (ms).
   * timeout: worker will call wait(timeout) before processing, truncating the queue for that group for X ms (one job per group at a time).
   *
   * @example POST /queue/message
   * {
   *   "instanceId": "inst1",
   *   "customerId": "cust1",
   *   "message": { "type": "text", "message": "Hello" },
   *   "timeout": 120000
   * }
   */
  @Post(':queueType')
  addJob(
    @Param('queueType') queueType: string,
    @Body() body: any,
  ) {
    // Extract options if provided (orderMs, delay, groupId, timeout)
    const { orderMs, delay, groupId, timeout, ...data } = body;
    const jobSendedAt = Date.now();
    const options = { orderMs, delay, groupId, timeout, jobSendedAt };

    // Emit event (listener will add job to queue)
    this.queueEventEmitter.emit(queueType as QueueType, data, options);

    return {
      success: true,
      message: 'Event emitted, job will be added to queue',
      queueType,
      groupId: groupId || (data.instanceId && data.customerId ? `${data.instanceId}:${data.customerId}` : undefined),
      timeout: timeout != null ? timeout : undefined,
      jobSendedAt,
    };
  }

  /**
   * Get queue status for a specific queue
   * GET /queue/:queueType/status
   */
  @Get(':queueType/status')
  async getQueueStatus(@Param('queueType') queueType: string) {
    const queue = this.queueManager.getQueue(queueType as QueueType);
    const counts = await queue.getJobCounts();
    const config = this.queueManager.getQueueConfig(queueType as QueueType);

    return {
      queueType,
      namespace: config.namespace,
      maxConcurrency: config.maxConcurrency,
      counts: {
        waiting: counts.waiting,
        active: counts.active,
        completed: counts.completed,
        failed: counts.failed,
        delayed: counts.delayed,
      },
    };
  }

  /**
   * Get status for all queues
   * GET /queue/status
   */
  @Get('status')
  async getAllQueuesStatus() {
    const queueTypes: QueueType[] = ['message', 'importations', 'exportations'];
    const statuses = await Promise.all(
      queueTypes.map(async (queueType) => {
        const queue = this.queueManager.getQueue(queueType as QueueType);
        const counts = await queue.getJobCounts();
        const config = this.queueManager.getQueueConfig(queueType);

        return {
          queueType,
          namespace: config.namespace,
          maxConcurrency: config.maxConcurrency,
          counts: {
            waiting: counts.waiting,
            active: counts.active,
            completed: counts.completed,
            failed: counts.failed,
            delayed: counts.delayed,
          },
        };
      }),
    );

    return {
      queues: statuses,
    };
  }

  /**
   * Test endpoint: Populate all 3 queues with sample jobs
   * POST /queue/test/populate
   * 
   * This endpoint will:
   * - Add 3 jobs to message queue
   * - Add 2 jobs to importations queue
   * - Add 2 jobs to exportations queue
   */
  @Post('test/populate')
  populateTestQueues() {
    const timestamp = Date.now();
    const results: {}[] = [];

    // Populate message queue
    for (let i = 1; i <= 3; i++) {
      this.queueEventEmitter.emit('message', {
        instanceId: `inst-${i}`,
        customerId: `cust-${i}`,
        message: {
          type: 'text',
          message: `Test message ${i} - ${new Date().toISOString()}`,
        },
      });
      results.push({ queueType: 'message', job: i, instanceId: `inst-${i}`, customerId: `cust-${i}` });
    }

    // Populate importations queue
    for (let i = 1; i <= 2; i++) {
      this.queueEventEmitter.emit('importations', {
        instanceId: `inst-${i}`,
        customerId: `cust-${i}`,
        importType: 'csv',
        fileUrl: `https://example.com/import-${i}.csv`,
        options: {
          delimiter: ',',
          encoding: 'utf-8',
        },
      });
      results.push({ queueType: 'importations', job: i, instanceId: `inst-${i}`, importType: 'csv' });
    }

    // Populate exportations queue
    for (let i = 1; i <= 2; i++) {
      this.queueEventEmitter.emit('exportations', {
        instanceId: `inst-${i}`,
        customerId: `cust-${i}`,
        exportType: 'reports',
        format: 'pdf',
        filters: {
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
        },
      });
      results.push({ queueType: 'exportations', job: i, instanceId: `inst-${i}`, exportType: 'reports' });
    }

    return {
      success: true,
      message: 'Test jobs added to all queues',
      timestamp,
      jobsAdded: results,
      summary: {
        message: 3,
        importations: 2,
        exportations: 2,
        total: 7,
      },
    };
  }

  /**
   * Test endpoint: Populate message queue with groupId testing
   * POST /queue/test/populate-messages
   * 
   * This endpoint tests groupId functionality:
   * - 10 messages distributed across 3 customers (same instanceId, different customerIds)
   *   → Should create 3 groups: inst1:cust1, inst1:cust2, inst1:cust3
   * - 10 messages for same customerId but different instanceIds
   *   → Should create 10 different groups: inst1:cust1, inst2:cust1, inst3:cust1, etc.
   */
  @Post('test/populate-messages')
  populateTestMessages() {
    const timestamp = Date.now();
    const results: any[] = [];
    const baseTime = Date.now();

    // Scenario 1: Same instanceId, 3 different customerIds (10 messages total)
    const instanceId1 = 'inst-test-1';
    const customers = ['cust-1', 'cust-2', 'cust-3'];

    console.log('📝 [Test] Adding 10 messages with same instanceId across 3 customers...');
    for (let i = 1; i <= 10; i++) {
      const customerId = customers[(i - 1) % 3];
      const groupId = `${instanceId1}:${customerId}`;

      this.queueEventEmitter.emit('message', {
        instanceId: instanceId1,
        customerId: customerId,
        message: {
          type: 'text',
          message: `Message ${i} for ${customerId} (same instance)`,
        },
      }, { orderMs: baseTime + i * 100 });

      results.push({
        scenario: 'same-instance',
        message: i,
        instanceId: instanceId1,
        customerId: customerId,
        groupId: groupId,
      });
    }

    // Scenario 2: Same customerId, 10 different instanceIds (10 messages total)
    const customerId1 = 'cust-test-1';

    console.log('📝 [Test] Adding 10 messages with same customerId across 10 instances...');
    for (let i = 1; i <= 10; i++) {
      const instanceId = `inst-test-${i}`;
      const groupId = `${instanceId}:${customerId1}`;

      this.queueEventEmitter.emit('message', {
        instanceId: instanceId,
        customerId: customerId1,
        message: {
          type: 'text',
          message: `Message ${i} for instance ${instanceId} (same customer)`,
        },
      }, { orderMs: baseTime + 2000 + i * 100 });

      results.push({
        scenario: 'same-customer',
        message: i,
        instanceId: instanceId,
        customerId: customerId1,
        groupId: groupId,
      });
    }

    const groupsScenario1 = new Set(
      results.filter(r => r.scenario === 'same-instance').map(r => r.groupId),
    );
    const groupsScenario2 = new Set(
      results.filter(r => r.scenario === 'same-customer').map(r => r.groupId),
    );

    return {
      success: true,
      message: 'Test messages added to message queue',
      timestamp,
      summary: {
        totalMessages: 20,
        scenario1: {
          description: 'Same instanceId, 3 different customerIds',
          messages: 10,
          expectedGroups: 3,
          actualGroups: groupsScenario1.size,
          groups: Array.from(groupsScenario1),
        },
        scenario2: {
          description: 'Same customerId, 10 different instanceIds',
          messages: 10,
          expectedGroups: 10,
          actualGroups: groupsScenario2.size,
          groups: Array.from(groupsScenario2),
        },
      },
      jobsAdded: results,
    };
  }

  // ─── Test kind 1: Same instance, 10 messages per customer, 3 customers ───
  /**
   * POST /queue/test/same-instance-multi-customer
   * Same instance sends 10 messages for each of 3 customers → 30 messages, 3 groups.
   */
  @Post('test/same-instance-multi-customer')
  testSameInstanceMultiCustomer() {
    const timestamp = Date.now();
    const instanceId = 'inst-single';
    const customers = ['cust-A', 'cust-B', 'cust-C'];
    const messagesPerCustomer = 10;
    const results: any[] = [];
    const baseTime = Date.now();

    for (const customerId of customers) {
      for (let m = 1; m <= messagesPerCustomer; m++) {
        const groupId = `${instanceId}:${customerId}`;
        this.queueEventEmitter.emit(
          'message',
          {
            instanceId,
            customerId,
            message: {
              type: 'text',
              message: `[${instanceId}] Message ${m}/${messagesPerCustomer} for ${customerId}`,
            },
          },
          { orderMs: baseTime + results.length * 50 },
        );
        results.push({ instanceId, customerId, groupId, messageIndex: m });
      }
    }

    const groups = [...new Set(results.map(r => r.groupId))];
    return {
      success: true,
      kind: 'same-instance-multi-customer',
      timestamp,
      summary: {
        description: 'Same instance, 10 messages per customer, 3 customers',
        instanceId,
        customers,
        messagesPerCustomer,
        totalMessages: results.length,
        groupsCount: groups.length,
        groups,
      },
      jobsAdded: results.length,
    };
  }

  // ─── Test kind 2: Same customer, 3 messages per instance, 10 instances ───
  /**
   * POST /queue/test/same-customer-multi-instance
   * Same customer receives 3 messages from each of 10 instances → 30 messages, 10 groups.
   */
  @Post('test/same-customer-multi-instance')
  testSameCustomerMultiInstance() {
    const timestamp = Date.now();
    const customerId = 'cust-single';
    const instanceCount = 10;
    const messagesPerInstance = 3;
    const results: any[] = [];
    const baseTime = Date.now();

    for (let i = 1; i <= instanceCount; i++) {
      const instanceId = `inst-${i}`;
      for (let m = 1; m <= messagesPerInstance; m++) {
        const groupId = `${instanceId}:${customerId}`;
        this.queueEventEmitter.emit(
          'message',
          {
            instanceId,
            customerId,
            message: {
              type: 'text',
              message: `[${instanceId}] Message ${m}/${messagesPerInstance} for customer ${customerId}`,
            },
          },
          { orderMs: baseTime + results.length * 50 },
        );
        results.push({ instanceId, customerId, groupId, messageIndex: m });
      }
    }

    const groups = [...new Set(results.map(r => r.groupId))];
    return {
      success: true,
      kind: 'same-customer-multi-instance',
      timestamp,
      summary: {
        description: 'Same customer, 3 messages per instance, 10 instances',
        customerId,
        instanceCount,
        messagesPerInstance,
        totalMessages: results.length,
        groupsCount: groups.length,
        groups,
      },
      jobsAdded: results.length,
    };
  }

  // ─── Test kind 3: 2 instances × 4 customers × 25 messages each ───
  /**
   * POST /queue/test/multi-instance-multi-customer
   * 2 instances, 4 customers, 25 messages per (instance, customer) → 200 messages, 8 groups.
   */
  @Post('test/multi-instance-multi-customer')
  testMultiInstanceMultiCustomer() {
    const timestamp = Date.now();
    const instanceIds = ['inst-P', 'inst-Q'];
    const customerIds = ['cust-1', 'cust-2', 'cust-3', 'cust-4'];
    const messagesPerGroup = 25;
    const results: any[] = [];
    const baseTime = Date.now();

    for (const instanceId of instanceIds) {
      for (const customerId of customerIds) {
        for (let m = 1; m <= messagesPerGroup; m++) {
          const groupId = `${instanceId}:${customerId}`;
          this.queueEventEmitter.emit(
            'message',
            {
              instanceId,
              customerId,
              message: {
                type: 'text',
                message: `[${instanceId}:${customerId}] Message ${m}/${messagesPerGroup}`,
              },
            },
            { orderMs: baseTime + results.length * 10 },
          );
          results.push({ instanceId, customerId, groupId, messageIndex: m });
        }
      }
    }

    const groups = [...new Set(results.map(r => r.groupId))];
    return {
      success: true,
      kind: 'multi-instance-multi-customer',
      timestamp,
      summary: {
        description: '2 instances × 4 customers × 25 messages each',
        instanceIds,
        customerIds,
        messagesPerGroup,
        totalMessages: results.length,
        groupsCount: groups.length,
        groups,
      },
      jobsAdded: results.length,
    };
  }

  // ─── Test: timeout behavior (wait truncates queue per group) ───
  /**
   * POST /queue/test/populate-timeout
   *
   * Adds 3 messages to the same group to test timeout behavior (long: 2 min, 3 min).
   * - Message 1: timeout 2 minutes – worker waits 2 min then processes
   * - Message 2: no timeout – processes right after message 1
   * - Message 3: timeout 3 minutes – worker waits 3 min then processes
   *
   * For quick tests (jobSendedAt / processedAt / processPid in DB), use POST /queue/test/populate-timeout-short instead.
   */
  @Post('test/populate-timeout')
  populateTestTimeout() {
    return this.populateTimeoutInternal(
      'inst-timeout-test',
      'cust-timeout-test',
      2 * 60 * 1000,
      3 * 60 * 1000,
      '2 minutes',
      '3 minutes',
      '[Timeout test] Message 1 – will wait 2 minutes before processing',
      '[Timeout test] Message 2 – no timeout, processes after message 1',
      '[Timeout test] Message 3 – will wait 3 minutes before processing',
    );
  }

  /**
   * POST /queue/test/populate-timeout-short
   *
   * Same as populate-timeout but with short timeouts (10s, 15s) so you can verify
   * jobSendedAt, processedAt, processPid in the database without waiting 5+ minutes.
   * - Message 1: timeout 10 seconds
   * - Message 2: no timeout
   * - Message 3: timeout 15 seconds
   */
  @Post('test/populate-timeout-short')
  populateTestTimeoutShort() {
    return this.populateTimeoutInternal(
      'inst-timeout-short',
      'cust-timeout-short',
      10 * 1000,
      15 * 1000,
      '10 seconds',
      '15 seconds',
      '[Timeout short] Message 1 – wait 10s then process',
      '[Timeout short] Message 2 – no timeout',
      '[Timeout short] Message 3 – wait 15s then process',
    );
  }

  private populateTimeoutInternal(
    instanceId: string,
    customerId: string,
    timeout1Ms: number,
    timeout3Ms: number,
    desc1: string,
    desc3: string,
    msg1: string,
    msg2: string,
    msg3: string,
  ) {
    const timestamp = Date.now();
    const groupId = `${instanceId}:${customerId}`;
    const baseTime = Date.now();

    this.queueEventEmitter.emit(
      'message',
      { instanceId, customerId, message: { type: 'text', message: msg1 } },
      { orderMs: baseTime + 1, timeout: timeout1Ms },
    );
    this.queueEventEmitter.emit(
      'message',
      { instanceId, customerId, message: { type: 'text', message: msg2 } },
      { orderMs: baseTime + 2 },
    );
    this.queueEventEmitter.emit(
      'message',
      { instanceId, customerId, message: { type: 'text', message: msg3 } },
      { orderMs: baseTime + 3, timeout: timeout3Ms },
    );

    return {
      success: true,
      message: 'Test timeout jobs added to message queue (same group)',
      timestamp,
      groupId,
      jobsAdded: [
        { index: 1, timeoutMs: timeout1Ms, description: desc1 },
        { index: 2, timeoutMs: null, description: 'no timeout' },
        { index: 3, timeoutMs: timeout3Ms, description: desc3 },
      ],
      summary: {
        description: 'One job per group at a time; wait(timeout) truncates the queue for that group',
        sequence: `Job1 wait ${desc1} → process → Job2 process → Job3 wait ${desc3} → process`,
      },
    };
  }
}

