/**
 * @file eventBus.test.js
 * @description Unit tests for EventBus module.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus, eventBus } from '../src/utils/eventBus.js';

describe('EventBus Unit Tests', () => {
  /** @type {EventBus} */
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('should subscribe a listener and successfully receive published payloads', () => {
    const received = [];
    bus.subscribe('player:damage', (data) => {
      received.push(data);
    });

    const notifiedCount = bus.publish('player:damage', { amount: 25, source: 'ghost' });

    assert.equal(notifiedCount, 1);
    assert.equal(received.length, 1);
    assert.deepEqual(received[0], { amount: 25, source: 'ghost' });
  });

  it('should support multiple subscribers on the same topic in order', () => {
    const callOrder = [];

    bus.subscribe('wave:spawn', () => callOrder.push('first'));
    bus.subscribe('wave:spawn', () => callOrder.push('second'));

    const count = bus.publish('wave:spawn', { wave: 1 });

    assert.equal(count, 2);
    assert.deepEqual(callOrder, ['first', 'second']);
  });

  it('should unsubscribe using the returned callback function', () => {
    let callCount = 0;
    const unsubscribe = bus.subscribe('screamer:trigger', () => {
      callCount += 1;
    });

    bus.publish('screamer:trigger');
    assert.equal(callCount, 1);
    assert.equal(bus.listenerCount('screamer:trigger'), 1);

    // Unsubscribe via callback
    const removed = unsubscribe();
    assert.equal(removed, true);
    assert.equal(bus.listenerCount('screamer:trigger'), 0);

    // Publish again, handler must not be called
    bus.publish('screamer:trigger');
    assert.equal(callCount, 1);
  });

  it('should unsubscribe using the explicit unsubscribe method', () => {
    const handler = () => {};
    bus.subscribe('camera:capture', handler);
    assert.equal(bus.listenerCount('camera:capture'), 1);

    const removed = bus.unsubscribe('camera:capture', handler);
    assert.equal(removed, true);
    assert.equal(bus.listenerCount('camera:capture'), 0);

    // Unsubscribing non-existent handler should return false
    const removedAgain = bus.unsubscribe('camera:capture', handler);
    assert.equal(removedAgain, false);
  });

  it('should defensively isolate subscriber exceptions and continue dispatching', () => {
    let secondHandlerCalled = false;

    bus.subscribe('test:error', () => {
      throw new Error('Simulated subscriber exception');
    });

    bus.subscribe('test:error', () => {
      secondHandlerCalled = true;
    });

    // Should not throw to caller
    const notified = bus.publish('test:error', { timestamp: Date.now() });

    assert.equal(secondHandlerCalled, true);
    assert.equal(notified, 1);
  });

  it('should throw TypeError when subscribing with invalid eventName or handler', () => {
    assert.throws(() => bus.subscribe('', () => {}), {
      name: 'TypeError',
      message: /eventName must be a non-empty string/
    });

    assert.throws(() => bus.subscribe(123, () => {}), {
      name: 'TypeError',
      message: /eventName must be a non-empty string/
    });

    assert.throws(() => bus.subscribe('valid:event', null), {
      name: 'TypeError',
      message: /handler must be a function/
    });

    assert.throws(() => bus.subscribe('valid:event', 'notAFunction'), {
      name: 'TypeError',
      message: /handler must be a function/
    });
  });

  it('should clear specific event topic or all topics when requested', () => {
    bus.subscribe('event:a', () => {});
    bus.subscribe('event:b', () => {});
    assert.equal(bus.listenerCount('event:a'), 1);
    assert.equal(bus.listenerCount('event:b'), 1);

    bus.clear('event:a');
    assert.equal(bus.listenerCount('event:a'), 0);
    assert.equal(bus.listenerCount('event:b'), 1);

    bus.clear();
    assert.equal(bus.listenerCount('event:b'), 0);
  });

  it('should export frozen singleton instance', () => {
    assert.ok(eventBus instanceof EventBus);
    assert.ok(Object.isFrozen(eventBus));
  });
});
