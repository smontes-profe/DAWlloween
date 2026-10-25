/**
 * @file hallOfFameSync.test.js
 * @description Unit tests for Hall of Fame dynamic synchronisation, background polling,
 * and tab visibility detection (US4.2 / T4).
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { HallOfFameView } from '../src/views/hallOfFameView.js';

/**
 * Creates a mock DOM container for testing.
 */
function createMockContainer() {
  const container = {
    innerHTML: '',
    querySelector(selector) {
      if (selector === '#hall-grid-container') {
        if (!this._grid) this._grid = { innerHTML: '' };
        return this._grid;
      }
      if (selector === '#hall-count-badge') {
        if (!this._badge) this._badge = { textContent: '' };
        return this._badge;
      }
      if (selector === '#btn-hall-refresh' || selector === '#btn-fab-refresh') {
        return {
          addEventListener: () => {},
          removeEventListener: () => {},
          classList: { add: () => {}, remove: () => {} }
        };
      }
      return null;
    }
  };
  return container;
}

describe('Hall of Fame Dynamic Synchronization & Polling (US4.2 / T4)', () => {
  let mockContainer;
  let mockAlerts;

  beforeEach(() => {
    mockContainer = createMockContainer();
    mockAlerts = {
      infoCalls: [],
      errorCalls: [],
      info(msg, title) { this.infoCalls.push({ msg, title }); },
      error(msg, title) { this.errorCalls.push({ msg, title }); }
    };
  });

  it('should initialise and start background polling timer with configured interval', async () => {
    const mockSupabase = {
      fetchHallOfFame: async () => [{ id: '1', nickname: 'Ghost1' }]
    };

    const view = new HallOfFameView({
      supabaseService: mockSupabase,
      alertsService: mockAlerts,
      pollIntervalMs: 15000,
      enablePolling: true
    });

    await view.mount(mockContainer);

    assert.ok(view.pollTimer !== null, 'Polling timer should be active');
    assert.equal(view.pollIntervalMs, 15000);
    assert.equal(view.enablePolling, true);

    view.destroy();
    assert.equal(view.pollTimer, null, 'Polling timer should be stopped on destroy');
  });

  it('should not start polling timer if enablePolling is explicitly false', async () => {
    const mockSupabase = {
      fetchHallOfFame: async () => []
    };

    const view = new HallOfFameView({
      supabaseService: mockSupabase,
      alertsService: mockAlerts,
      enablePolling: false
    });

    await view.mount(mockContainer);

    assert.equal(view.pollTimer, null, 'Polling timer should not start when disabled');
    view.destroy();
  });

  it('should emit toast notification when new reactions arrive during polling', async () => {
    let mockData = [
      { id: '101', nickname: 'FirstSoul', photo_url: 'https://example.com/1.webp' }
    ];

    const dynamicSupabase = {
      fetchHallOfFame: async () => mockData
    };

    const view = new HallOfFameView({
      supabaseService: dynamicSupabase,
      alertsService: mockAlerts,
      enablePolling: false // manual trigger for test control
    });

    // Initial mount
    await view.mount(mockContainer);
    assert.equal(view.reactions.length, 1);
    assert.equal(mockAlerts.infoCalls.length, 0); // No alert on initial mount

    // Simulate new reaction arrived on Supabase
    mockData = [
      { id: '102', nickname: 'SecondSoul', photo_url: 'https://example.com/2.webp' },
      { id: '101', nickname: 'FirstSoul', photo_url: 'https://example.com/1.webp' }
    ];

    // Trigger polling cycle
    await view.loadReactions({ isPolling: true });

    assert.equal(view.reactions.length, 2);
    assert.equal(mockAlerts.infoCalls.length, 1);
    assert.ok(mockAlerts.infoCalls[0].msg.includes('1 nueva alma'));

    view.destroy();
  });

  it('should handle visibilitychange correctly to pause when hidden and resume when visible', async () => {
    const mockSupabase = {
      fetchHallOfFame: async () => [{ id: '1', nickname: 'Vampire' }]
    };

    const view = new HallOfFameView({
      supabaseService: mockSupabase,
      alertsService: mockAlerts,
      pollIntervalMs: 5000,
      enablePolling: true
    });

    // Mock document.hidden
    const originalDocument = globalThis.document;
    let mockHidden = false;
    let visibilityListeners = [];

    globalThis.document = {
      get hidden() { return mockHidden; },
      addEventListener(type, listener) {
        if (type === 'visibilitychange') visibilityListeners.push(listener);
      },
      removeEventListener(type, listener) {
        if (type === 'visibilitychange') {
          visibilityListeners = visibilityListeners.filter((l) => l !== listener);
        }
      }
    };

    try {
      await view.mount(mockContainer);
      assert.ok(view.pollTimer !== null);

      // Simulate tab hidden
      mockHidden = true;
      for (const listener of visibilityListeners) {
        await listener();
      }
      assert.equal(view.pollTimer, null, 'Polling should be paused when document.hidden is true');

      // Simulate tab visible again
      mockHidden = false;
      for (const listener of visibilityListeners) {
        await listener();
      }
      assert.ok(view.pollTimer !== null, 'Polling should resume when document.hidden is false');
    } finally {
      view.destroy();
      globalThis.document = originalDocument;
    }
  });

  it('should stop polling cleanly via stopPolling() and destroy()', () => {
    const view = new HallOfFameView({
      pollIntervalMs: 5000,
      enablePolling: true
    });

    view.pollTimer = setInterval(() => {}, 10000);
    assert.ok(view.pollTimer !== null);

    view.stopPolling();
    assert.equal(view.pollTimer, null);

    view.pollTimer = setInterval(() => {}, 10000);
    view.destroy();
    assert.equal(view.pollTimer, null);
  });
});
