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
 */
export interface MessageQueuePayload extends BaseQueueData {
  instanceId: string;
  customerId: string;
  message: MessageQueueData['message'];
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
}
