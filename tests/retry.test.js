/**
 * @file retry.test.js
 * @description Unit tests for in-memory resilience and retry manager (withRetry).
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry, calculateBackoff } from '../src/utils/retry.js';
import { eventBus } from '../src/utils/eventBus.js';

describe('Retry Manager Unit Tests (US3.4 / T3)', () => {
  let mockSleepCalls;
  const mockSleep = async (ms) => {
    mockSleepCalls.push(ms);
  };

  beforeEach(() => {
    mockSleepCalls = [];
  });

  it('should successfully return result on initial attempt without retries', async () => {
    let callCount = 0;
    const result = await withRetry(async () => {
      callCount++;
      return 'success-payload';
    }, { sleepFn: mockSleep });

    assert.equal(result, 'success-payload');
    assert.equal(callCount, 1);
    assert.equal(mockSleepCalls.length, 0);
  });

  it('should retry on transient failures and succeed when operation eventually succeeds', async () => {
    let callCount = 0;
    const retryLog = [];

    const result = await withRetry(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error(`Transient drop #${callCount}`);
      }
      return 'recovered-data';
    }, {
      maxRetries: 3,
      initialDelayMs: 100,
      backoffFactor: 2,
      jitter: false,
      sleepFn: mockSleep,
      onRetry: (err, attempt, delay) => {
        retryLog.push({ err: err.message, attempt, delay });
      }
    });

    assert.equal(result, 'recovered-data');
    assert.equal(callCount, 3);
    assert.equal(mockSleepCalls.length, 2);
    assert.equal(retryLog.length, 2);
    assert.equal(retryLog[0].attempt, 1);
    assert.equal(retryLog[0].delay, 100);
    assert.equal(retryLog[1].attempt, 2);
    assert.equal(retryLog[1].delay, 200);
  });

  it('should throw the final error when maxRetries threshold is exceeded', async () => {
    let callCount = 0;

    await assert.rejects(async () => {
      await withRetry(async () => {
        callCount++;
        throw new Error('Persistent network partition');
      }, {
        maxRetries: 2,
        sleepFn: mockSleep
      });
    }, (err) => {
      assert.equal(err.message, 'Persistent network partition');
      return true;
    });

    // 1 initial attempt + 2 retries = 3 attempts total
    assert.equal(callCount, 3);
    assert.equal(mockSleepCalls.length, 2);
  });

  it('should publish storage:retry and storage:error events via EventBus', async () => {
    const retryEvents = [];
    const errorEvents = [];

    const unsubRetry = eventBus.subscribe('storage:retry', (p) => retryEvents.push(p));
    const unsubError = eventBus.subscribe('storage:error', (p) => errorEvents.push(p));

    await assert.rejects(async () => {
      await withRetry(async () => {
        throw new Error('Cloud unreachable');
      }, {
        maxRetries: 2,
        initialDelayMs: 50,
        jitter: false,
        sleepFn: mockSleep,
        emitEvents: true
      });
    });

    unsubRetry();
    unsubError();

    assert.equal(retryEvents.length, 2);
    assert.equal(retryEvents[0].attempt, 1);
    assert.equal(retryEvents[0].maxRetries, 2);
    assert.equal(retryEvents[1].attempt, 2);

    assert.equal(errorEvents.length, 1);
    assert.equal(errorEvents[0].error, 'Cloud unreachable');
    assert.equal(errorEvents[0].attempts, 3);
  });

  it('should calculate exponential backoff with and without jitter correctly', () => {
    const delay1 = calculateBackoff(1, 1000, 2, false);
    assert.equal(delay1, 1000);

    const delay2 = calculateBackoff(2, 1000, 2, false);
    assert.equal(delay2, 2000);

    const delay3 = calculateBackoff(3, 1000, 2, false);
    assert.equal(delay3, 4000);

    // With jitter (+/- 20%)
    const jittered = calculateBackoff(2, 1000, 2, true);
    assert.ok(jittered >= 1600 && jittered <= 2400);
  });
});
