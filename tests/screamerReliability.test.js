/**
 * @file screamerReliability.test.js
 * @description Unit tests validating jumpscare activation reliability, video preloading,
 * safety fallback timers, and exposure duration synchronisation (EPIC5 / US5.2 / T1).
 * Standards: UK English (en-GB).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ScreamerView,
  DEFAULT_SCREAMER_DURATION_MS,
  DEFAULT_SAFETY_FALLBACK_TIMEOUT_MS,
  BUFFERING_FALLBACK_THRESHOLD_MS
} from '../src/views/screamerView.js';
import { DEFAULT_RECORDING_DURATION_MS } from '../src/screamer/recorder.js';
import { SCREAMER_CONFIG } from '../src/config.js';
import { eventBus } from '../src/utils/eventBus.js';

class MockElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.innerHTML = '';
    this.childNodes = [];
    this.listeners = new Map();
    this.style = {};
    this.attributes = new Map();
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c)
    };
  }

  appendChild(child) {
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    this.childNodes = this.childNodes.filter((c) => c !== child);
    return child;
  }

  setAttribute(k, v) { this.attributes.set(k, v); }
  getAttribute(k) { return this.attributes.get(k) || null; }

  addEventListener(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  removeEventListener(event, handler) {
    if (this.listeners.has(event)) {
      const list = this.listeners.get(event).filter((h) => h !== handler);
      this.listeners.set(event, list);
    }
  }

  dispatchEvent(event) {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach((h) => h({ type: event }));
  }

  querySelector(selector) {
    if (selector === '.screamer-view') {
      const el = new MockElement('section');
      el.className = 'screamer-view';
      return el;
    }
    if (selector === '.screamer-view__video') {
      return this._mockVideo;
    }
    if (selector === '#screamer-chroma-canvas') {
      return this._mockCanvas;
    }
    if (selector === '.screamer-view__monster') {
      return this._mockMonster;
    }
    return null;
  }
}

function createReliabilityDom() {
  const windowListeners = new Map();
  const scheduledTimeouts = new Map();
  let nextTimeoutId = 100;

  const mockWindow = {
    location: { hash: '#play' },
    setTimeout: (fn, delay) => {
      const id = ++nextTimeoutId;
      scheduledTimeouts.set(id, { fn, delay });
      mockWindow._lastDelay = delay;
      mockWindow._lastId = id;
      return id;
    },
    clearTimeout: (id) => {
      scheduledTimeouts.delete(id);
      mockWindow._clearedId = id;
    },
    addEventListener: (event, handler) => {
      if (!windowListeners.has(event)) {
        windowListeners.set(event, []);
      }
      windowListeners.get(event).push(handler);
    },
    removeEventListener: (event, handler) => {
      if (windowListeners.has(event)) {
        const list = windowListeners.get(event).filter((h) => h !== handler);
        windowListeners.set(event, list);
      }
    },
    _scheduledTimeouts: scheduledTimeouts,
    _triggerTimeout: (id) => {
      const entry = scheduledTimeouts.get(id);
      if (entry) {
        scheduledTimeouts.delete(id);
        entry.fn();
      }
    }
  };

  const container = new MockElement('main');

  const mockVideo = new MockElement('video');
  mockVideo.className = 'screamer-view__video';
  mockVideo.play = () => Promise.resolve();
  mockVideo.pause = () => {};
  mockVideo.load = () => {};

  const mockCanvas = new MockElement('canvas');
  mockCanvas.id = 'screamer-chroma-canvas';
  mockCanvas.getContext = () => ({
    drawImage: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray(16) }),
    putImageData: () => {}
  });

  const mockMonster = new MockElement('svg');
  mockMonster.className = 'screamer-view__monster screamer-view__monster--hidden';
  mockMonster.classList.add('screamer-view__monster--hidden');

  container._mockVideo = mockVideo;
  container._mockCanvas = mockCanvas;
  container._mockMonster = mockMonster;

  return { mockWindow, container, mockVideo, mockCanvas, mockMonster };
}

describe('Jumpscare Activation Reliability Unit Tests (US5.2 / T1)', () => {
  let originalWindow;
  let originalDocument;
  let view;

  beforeEach(() => {
    originalWindow = global.window;
    originalDocument = global.document;
    view = new ScreamerView();
  });

  afterEach(() => {
    if (view) {
      view.unmount();
    }
    if (originalWindow !== undefined) {
      global.window = originalWindow;
    }
    if (originalDocument !== undefined) {
      global.document = originalDocument;
    }
  });

  it('should support static video preloading via ScreamerView.preload()', () => {
    let createdTag = null;
    let createdElement = null;

    global.document = {
      createElement: (tag) => {
        createdTag = tag;
        createdElement = {
          src: '',
          preload: '',
          muted: false,
          setAttribute: () => {},
          load: () => {}
        };
        return createdElement;
      }
    };

    // Clear any previous cached reference
    ScreamerView._preloadedVideo = null;

    const preloaded = ScreamerView.preload();
    assert.strictEqual(createdTag, 'video');
    assert.strictEqual(preloaded.preload, 'auto');
    assert.strictEqual(preloaded.muted, true);
    assert.ok(preloaded.src.includes('jumpscare.mp4'));

    // Second call should return cached instance
    const cached = ScreamerView.preload();
    assert.strictEqual(cached, preloaded);
  });

  it('should not publish artificial screamer:play-sound event on EventBus to avoid spoiler cues', () => {
    const { mockWindow, container } = createReliabilityDom();
    global.window = mockWindow;

    let soundEventFired = false;
    const unsub = eventBus.subscribe('screamer:play-sound', () => {
      soundEventFired = true;
    });

    try {
      view.mount(container);
      assert.strictEqual(soundEventFired, false);
    } finally {
      unsub();
    }
  });

  it('should establish an emergency safety timeout of 8000ms on mount without premature transition', () => {
    const { mockWindow, container } = createReliabilityDom();
    global.window = mockWindow;

    view.mount(container);

    // Initial emergency safety timeout must match DEFAULT_SAFETY_FALLBACK_TIMEOUT_MS (8000ms)
    assert.strictEqual(view.transitionTimeoutId !== null, true);
    const emergencyTimeout = mockWindow._scheduledTimeouts.get(view.transitionTimeoutId);
    assert.ok(emergencyTimeout);
    assert.strictEqual(emergencyTimeout.delay, DEFAULT_SAFETY_FALLBACK_TIMEOUT_MS);
    assert.strictEqual(mockWindow.location.hash, '#play');
  });

  it('should switch to 3000ms exposure timer once video emits play event', () => {
    const { mockWindow, container, mockVideo } = createReliabilityDom();
    global.window = mockWindow;

    view.mount(container);
    assert.strictEqual(view.isVideoActive, false);

    // Simulate video buffering completion and play event dispatch
    mockVideo.dispatchEvent('play');

    assert.strictEqual(view.isVideoActive, true);
    const exposureTimeout = mockWindow._scheduledTimeouts.get(view.transitionTimeoutId);
    assert.ok(exposureTimeout);
    assert.strictEqual(exposureTimeout.delay, DEFAULT_SCREAMER_DURATION_MS);

    // Trigger exposure timeout -> should navigate to #register
    mockWindow._triggerTimeout(view.transitionTimeoutId);
    assert.strictEqual(mockWindow.location.hash, '#register');
  });

  it('should activate SVG monster fallback and 3000ms timer when video buffering threshold is exceeded', () => {
    const { mockWindow, container, mockMonster } = createReliabilityDom();
    global.window = mockWindow;

    view.mount(container);

    // Verify buffering fallback guard was scheduled for BUFFERING_FALLBACK_THRESHOLD_MS (3500ms)
    assert.ok(view.bufferingFallbackTimeoutId !== null);
    const bufferingTimeout = mockWindow._scheduledTimeouts.get(view.bufferingFallbackTimeoutId);
    assert.ok(bufferingTimeout);
    assert.strictEqual(bufferingTimeout.delay, BUFFERING_FALLBACK_THRESHOLD_MS);

    // Trigger buffering timeout (simulating video stalled / hung)
    mockWindow._triggerTimeout(view.bufferingFallbackTimeoutId);

    // Monster SVG should now be displayed
    assert.strictEqual(mockMonster.classList.contains('screamer-view__monster--hidden'), false);

    // New exposure timeout of 3000ms must be active
    const fallbackExposure = mockWindow._scheduledTimeouts.get(view.transitionTimeoutId);
    assert.ok(fallbackExposure);
    assert.strictEqual(fallbackExposure.delay, DEFAULT_SCREAMER_DURATION_MS);
  });

  it('should activate SVG monster fallback immediately when video emits error event', () => {
    const { mockWindow, container, mockVideo, mockMonster } = createReliabilityDom();
    global.window = mockWindow;

    view.mount(container);

    mockVideo.dispatchEvent('error');

    assert.strictEqual(mockMonster.classList.contains('screamer-view__monster--hidden'), false);
    const errorExposure = mockWindow._scheduledTimeouts.get(view.transitionTimeoutId);
    assert.ok(errorExposure);
    assert.strictEqual(errorExposure.delay, DEFAULT_SCREAMER_DURATION_MS);
  });

  it('should calibrate default webcam reaction recording duration to match SCREAMER_CONFIG.durationMs', () => {
    assert.strictEqual(DEFAULT_RECORDING_DURATION_MS, SCREAMER_CONFIG.durationMs);
  });

  it('should cleanly cancel both transition and buffering timeouts on unmount()', () => {
    const { mockWindow, container } = createReliabilityDom();
    global.window = mockWindow;

    view.mount(container);
    assert.ok(view.transitionTimeoutId !== null);
    assert.ok(view.bufferingFallbackTimeoutId !== null);

    view.unmount();
    assert.strictEqual(view.transitionTimeoutId, null);
    assert.strictEqual(view.bufferingFallbackTimeoutId, null);
    assert.strictEqual(view.isVideoActive, false);
  });
});
