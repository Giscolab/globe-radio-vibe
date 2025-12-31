// Engine - Request Throttler for API Rate Limiting
import { logger } from './logger';

export interface ThrottleConfig {
  /** Maximum requests per second */
  requestsPerSecond: number;
  /** Maximum concurrent requests */
  maxConcurrent: number;
}

interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

/**
 * Request throttler with queue management
 * Ensures API rate limits are respected
 */
export class RequestThrottler {
  private queue: QueuedRequest<unknown>[] = [];
  private activeCount = 0;
  private lastRequestTime = 0;
  private readonly minInterval: number;
  private readonly config: ThrottleConfig;
  private processing = false;

  constructor(config: ThrottleConfig) {
    this.config = config;
    this.minInterval = 1000 / config.requestsPerSecond;
  }

  /**
   * Throttle a request function
   * Returns a promise that resolves when the request completes
   */
  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Wait if we've hit max concurrent requests
      if (this.activeCount >= this.config.maxConcurrent) {
        await this.sleep(10);
        continue;
      }

      // Wait for rate limit interval
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;
      if (elapsed < this.minInterval) {
        await this.sleep(this.minInterval - elapsed);
      }

      const request = this.queue.shift();
      if (!request) break;

      this.activeCount++;
      this.lastRequestTime = Date.now();

      // Execute request without blocking the queue
      this.executeRequest(request);
    }

    this.processing = false;
  }

  private async executeRequest<T>(request: QueuedRequest<T>): Promise<void> {
    try {
      const result = await request.fn();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeCount--;
      // Continue processing if there are more requests
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Current queue length */
  getQueueLength(): number {
    return this.queue.length;
  }

  /** Currently active requests */
  getActiveCount(): number {
    return this.activeCount;
  }

  /** Clear all pending requests */
  clear(): void {
    const pending = this.queue.length;
    this.queue.forEach(req => req.reject(new Error('Throttler cleared')));
    this.queue = [];
    if (pending > 0) {
      logger.info('Throttle', `Cleared ${pending} pending requests`);
    }
  }
}

/**
 * Pre-configured throttler for RadioBrowser API
 * - 5 requests per second
 * - Max 3 concurrent requests
 */
export const radioBrowserThrottler = new RequestThrottler({
  requestsPerSecond: 5,
  maxConcurrent: 3,
});
