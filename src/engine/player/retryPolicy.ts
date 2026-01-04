// Engine - Retry Policy with Exponential Backoff
import { logger } from '../core/logger';
import { playerMetrics } from './metrics';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  timeout?: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  timeout: 15000,
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff with jitter
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, config.maxDelay);
}

export async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < finalConfig.maxAttempts; attempt++) {
    try {
      // Wrap with timeout if configured
      if (finalConfig.timeout) {
        const result = await Promise.race([
          fn(attempt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), finalConfig.timeout)
          ),
        ]);
        return result;
      }
      
      return await fn(attempt);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn('RetryPolicy', `Attempt ${attempt + 1}/${finalConfig.maxAttempts} failed: ${lastError.message}`);
      playerMetrics.recordRetry();

      if (attempt < finalConfig.maxAttempts - 1) {
        const delay = calculateDelay(attempt, finalConfig);
        logger.debug('RetryPolicy', `Waiting ${delay}ms before retry`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}
