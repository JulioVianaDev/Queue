/**
 * Waits for a given number of milliseconds.
 * Used by queue jobs to "truncate" the queue for a group: while waiting,
 * no next job for that group is processed, so the queue is effectively paused for that group.
 *
 * @param timeoutInMilliseconds - Duration to wait in ms
 * @returns Promise that resolves after the delay
 */
export function wait(timeoutInMilliseconds: number): Promise<void> {
  if (timeoutInMilliseconds <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, timeoutInMilliseconds));
}
