export async function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(message)), timeoutMs);
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function retrySafe<T>(
  task: (attempt: number) => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  attempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1 || !shouldRetry(error)) throw error;
      const backoff = 150 * 2 ** attempt + Math.floor(Math.random() * 100);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw lastError;
}
