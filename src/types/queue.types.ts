import { MessageQueueData } from './messages.type';

/**
 * Queue types supported by the system
 */
export type QueueType = 'message' | 'importations' | 'exportations';

/**
 * Base interface for all queue data
 */
export interface BaseQueueData {
  groupId: string;
  [key: string]: any;
}

/**
 * Message queue data (already defined in messages.type.ts)
 * Optional timeout: when set, the worker will wait this many ms before processing,
 * effectively pausing the queue for this group for that duration (one job per group at a time).
 */
export interface MessageQueuePayload extends BaseQueueData {
  instanceId: string;
  customerId: string;
  message: MessageQueueData['message'];
  /** Optional timeout in ms: worker calls wait(timeout) before processing this job */
  timeout?: number;
  /** Set by listener when job is enqueued (epoch ms); stored in DB as jobSendedAt for timeout verification */
  jobSendedAt?: number;
}

/**
 * Importation queue data
 */
export interface ImportationQueuePayload extends BaseQueueData {
  instanceId: string;
  customerId?: string;
  importType: string;
  fileUrl?: string;
  filePath?: string;
  options?: Record<string, any>;
}

/**
 * Exportation queue data
 */
export interface ExportationQueuePayload extends BaseQueueData {
  instanceId: string;
  customerId?: string;
  exportType: string;
  filters?: Record<string, any>;
  format?: string;
  options?: Record<string, any>;
}

/**
 * Union type for all queue payloads
 */
export type QueuePayload<T extends QueueType> = T extends 'message'
  ? MessageQueuePayload
  : T extends 'importations'
    ? ImportationQueuePayload
    : T extends 'exportations'
      ? ExportationQueuePayload
      : never;

/**
 * Queue configuration
 */
export interface QueueConfig {
  name: QueueType;
  namespace: string;
  maxConcurrency: number;
  keepCompleted?: number;
  keepFailed?: number;
}

/**
 * Queue event options
 */
export interface QueueEventOptions {
  orderMs?: number;
  delay?: number;
  groupId?: string;
  /** Timeout in ms: job will wait this long before processing (truncates queue for group) */
  timeout?: number;
  /** When the job was sent/enqueued (epoch ms); set by controller for DB comparison with processedAt */
  jobSendedAt?: number;
}
