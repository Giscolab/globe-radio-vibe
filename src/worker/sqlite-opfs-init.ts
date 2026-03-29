import { logger } from '@/engine/core/logger';

export type DatabaseCommand =
  | 'init'
  | 'exec'
  | 'query'
  | 'value'
  | 'close'
  | 'deleteDatabase'
  | 'vacuum'
  | 'integrity'
  | 'analyze'
  | 'stats';

export interface DatabaseRequest<T = unknown> {
  id: number;
  type: DatabaseCommand;
  payload?: T;
}

export interface DatabaseResponse<T = unknown> {
  id: number;
  ok: boolean;
  result?: T;
  error?: string;
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

export interface SqliteWorkerClient {
  request<TResult = unknown, TPayload = unknown>(
    type: DatabaseCommand,
    payload?: TPayload
  ): Promise<TResult>;
  terminate(): Promise<void>;
}

export function createSqliteWorkerClient(): SqliteWorkerClient {
  const worker = new Worker(new URL('./sqlite-worker.ts', import.meta.url), {
    type: 'module',
  });

  let requestId = 0;
  const pending = new Map<number, PendingRequest>();

  worker.addEventListener('message', (event: MessageEvent<DatabaseResponse>) => {
    const message = event.data;
    if (!message || typeof message.id !== 'number') {
      return;
    }

    const entry = pending.get(message.id);
    if (!entry) {
      return;
    }

    pending.delete(message.id);

    if (message.ok) {
      entry.resolve(message.result);
      return;
    }

    entry.reject(new Error(message.error ?? 'Unknown SQLite worker error'));
  });

  worker.addEventListener('error', (event) => {
    const reason = event.error ?? new Error(event.message || 'SQLite worker crashed');
    logger.error('StorageWorker', 'Worker error', reason);

    for (const entry of pending.values()) {
      entry.reject(reason);
    }
    pending.clear();
  });

  return {
    request<TResult = unknown, TPayload = unknown>(
      type: DatabaseCommand,
      payload?: TPayload
    ): Promise<TResult> {
      const id = ++requestId;

      return new Promise<TResult>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({
          id,
          type,
          payload,
        } satisfies DatabaseRequest<TPayload>);
      });
    },

    async terminate(): Promise<void> {
      for (const entry of pending.values()) {
        entry.reject(new Error('SQLite worker terminated'));
      }
      pending.clear();
      worker.terminate();
    },
  };
}
