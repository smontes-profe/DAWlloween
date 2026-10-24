/**
 * @file retry.js
 * @description In-memory resilience and retry mechanism with exponential backoff and jitter.
 * Complies strictly with zero local persistence constraints (no saving to localStorage, sessionStorage or cookies).
 * Publishes decoupled lifecycle events over the global EventBus for UI toast notifications.
 * Standards: Vanilla JavaScript (ES Modules), UK English (en-GB).
 */

import { eventBus } from './eventBus.js';

/**
 * Standard delay helper based on native Promises.
 *
 * @param {number} ms - Milliseconds to delay.
 * @returns {Promise<void>}
 */
export function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/**
 * Calculates the next retry delay using exponential backoff and optional randomised jitter.
 *
 * @param {number} attempt - Current attempt index (1-based).
 * @param {number} initialDelayMs - Base delay in milliseconds.
 * @param {number} backoffFactor - Multiplier factor per attempt.
 * @param {boolean} [jitter=true] - Whether to apply +/- 20% jitter.
 * @returns {number} Calculated delay in milliseconds.
 */
export function calculateBackoff(attempt, initialDelayMs, backoffFactor, jitter = true) {
  const exponential = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
  if (!jitter) {
    return Math.round(exponential);
  }
  // Apply random jitter between 80% and 120% of exponential delay
  const jitterFactor = 0.8 + Math.random() * 0.4;
  return Math.round(exponential * jitterFactor);
}

/**
 * Executes an asynchronous operation with automatic retries and exponential backoff.
 * All retry state is kept strictly in-memory.
 *
 * @template T
 * @param {() => Promise<T>} operation - Asynchronous task to execute.
 * @param {Object} [options={}] - Retry configuration options.
 * @param {number} [options.maxRetries=3] - Maximum retry attempts before failing.
 * @param {number} [options.initialDelayMs=1000] - Base delay for first retry.
 * @param {number} [options.backoffFactor=1.5] - Exponential multiplier.
 * @param {boolean} [options.jitter=true] - Whether to randomise delay slightly.
 * @param {Function} [options.onRetry] - Optional hook called on each retry `(err, attempt, delayMs)`.
 * @param {boolean} [options.emitEvents=true] - Whether to publish EventBus events.
 * @param {Function} [options.sleepFn=defaultSleep] - Injectable sleep function for deterministic testing.
 * @returns {Promise<T>} Result of the successful operation.
 * @throws {Error} The final error encountered once max retries are exhausted.
 */
export async function withRetry(operation, options = {}) {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    backoffFactor = 1.5,
    jitter = true,
    onRetry = null,
    emitEvents = true,
    sleepFn = defaultSleep
  } = options;

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (err) {
      attempt++;

      if (attempt > maxRetries) {
        if (emitEvents && eventBus && typeof eventBus.publish === 'function') {
          eventBus.publish('storage:error', {
            error: err.message || 'Operation failed after retries',
            attempts: attempt
          });
        }
        throw err;
      }

      const delayMs = calculateBackoff(attempt, initialDelayMs, backoffFactor, jitter);

      if (emitEvents && eventBus && typeof eventBus.publish === 'function') {
        eventBus.publish('storage:retry', {
          error: err.message || 'Transient network error',
          attempt,
          maxRetries,
          delayMs
        });
      }

      if (typeof onRetry === 'function') {
        try {
          onRetry(err, attempt, delayMs);
        } catch {
          // Swallow observer errors to prevent disrupting retry cycle
        }
      }

      await sleepFn(delayMs);
    }
  }
}

export default withRetry;
