/**
 * @file eventBus.js
 * @description Decoupled publish-subscribe (Pub-Sub) Event Bus pattern.
 * Enables loose coupling across UI, game engine, audio, camera, and network services.
 * Pedagogical reference for DAW students.
 * Standard: UK English (en-GB).
 */

/**
 * Pub-Sub Event Bus coordinating inter-module communication.
 */
export class EventBus {
  /**
   * Initialise an empty subscriber registry.
   */
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.subscribers = new Map();
  }

  /**
   * Subscribe a callback handler to a specific event topic.
   *
   * @param {string} eventName - The unique event identifier to listen for.
   * @param {Function} handler - The callback function invoked when the event is published.
   * @returns {Function} An unsubscribe function to cleanly detach the listener.
   * @throws {TypeError} If eventName is not a string or handler is not a function.
   */
  subscribe(eventName, handler) {
    if (typeof eventName !== 'string' || eventName.trim() === '') {
      throw new TypeError('EventBus: eventName must be a non-empty string.');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('EventBus: handler must be a function.');
    }

    const topic = eventName.trim();
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }

    const handlerSet = this.subscribers.get(topic);
    handlerSet.add(handler);

    // Return a convenient unsubscribe lambda for clean lifecycle management
    return () => this.unsubscribe(topic, handler);
  }

  /**
   * Unsubscribe a previously attached callback handler from an event.
   *
   * @param {string} eventName - The event identifier.
   * @param {Function} handler - The exact callback function to detach.
   * @returns {boolean} True if the handler was found and removed; false otherwise.
   */
  unsubscribe(eventName, handler) {
    if (typeof eventName !== 'string' || !this.subscribers.has(eventName.trim())) {
      return false;
    }

    const topic = eventName.trim();
    const handlerSet = this.subscribers.get(topic);
    const wasRemoved = handlerSet.delete(handler);

    if (handlerSet.size === 0) {
      this.subscribers.delete(topic);
    }

    return wasRemoved;
  }

  /**
   * Publish an event and payload to all registered subscriber callbacks.
   * Individual subscriber exceptions are trapped defensively so that a failing
   * subscriber does not prevent remaining handlers from receiving the event.
   *
   * @param {string} eventName - The event identifier to broadcast.
   * @param {*} [payload=null] - Optional arbitrary payload data passed to handlers.
   * @returns {number} The count of handlers successfully notified.
   */
  publish(eventName, payload = null) {
    if (typeof eventName !== 'string' || eventName.trim() === '') {
      return 0;
    }

    const topic = eventName.trim();
    const handlers = this.subscribers.get(topic);

    if (!handlers || handlers.size === 0) {
      return 0;
    }

    let notifiedCount = 0;
    // Snapshot handlers into an array to avoid iteration issues if handlers mutate the Set
    const handlersSnapshot = Array.from(handlers);

    for (const handler of handlersSnapshot) {
      try {
        handler(payload);
        notifiedCount += 1;
      } catch (error) {
        // Defensive error handling: log the error whilst preserving execution flow
        console.error(`[EventBus] Error executing subscriber for event "${topic}":`, error);
      }
    }

    return notifiedCount;
  }

  /**
   * Retrieve the current subscriber count for a given event topic.
   *
   * @param {string} eventName - The event identifier.
   * @returns {number} Total registered subscribers for the topic.
   */
  listenerCount(eventName) {
    if (typeof eventName !== 'string') {
      return 0;
    }
    const topic = eventName.trim();
    return this.subscribers.has(topic) ? this.subscribers.get(topic).size : 0;
  }

  /**
   * Clear all subscribers for a specified event topic, or wipe all topics if omitted.
   *
   * @param {string} [eventName] - Optional topic to clear. If omitted, all topics are cleared.
   */
  clear(eventName) {
    if (typeof eventName === 'string') {
      this.subscribers.delete(eventName.trim());
    } else {
      this.subscribers.clear();
    }
  }
}

/**
 * Singleton Event Bus instance for global application use.
 * Frozen to prevent external mutation of the service contract.
 */
export const eventBus = Object.freeze(new EventBus());

export default eventBus;
