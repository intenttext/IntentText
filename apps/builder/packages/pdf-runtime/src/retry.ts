export interface RetryOptions {
  retryAttempts: number;
  backoffMs?: (attempt: number) => number;
  onRetry?: (attempt: number, error: unknown) => Promise<void> | void;
}

export async function executeWithRetries<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const maxRetries = Math.max(0, Math.floor(options.retryAttempts));
  const backoffMs =
    options.backoffMs ?? ((attempt) => Math.min(500, 100 * 2 ** attempt));

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await options.onRetry?.(attempt, error);
        const delay = Math.max(0, Math.floor(backoffMs(attempt)));
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Operation failed after retries");
}
