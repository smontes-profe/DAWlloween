/**
 * @file screamerView.test.js
 * @description Unit tests for ScreamerView component (US2.1 / T3, T4).
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ScreamerView } from '../src/views/screamerView.js';
import { audioService } from '../src/services/audio.js';
import { eventBus } from '../src/utils/eventBus.js';

/**
 * Lightweight mock DOM for ScreamerView testing.
 */
function createMockDom() {
  const windowListeners = new Map();

  class MockElement {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.innerHTML = '';
      this.childNodes = [];
      this.listeners = new Map();
    }

    appendChild(child) {
      this.childNodes.push(child);
      return child;
    }

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

    querySelector(selector) {
      if (selector === '.screamer-view' && this.innerHTML.includes('class="screamer-view"')) {
        const el = new MockElement('section');
        el.className = 'screamer-view';
        return el;
      }
      if (selector === '.screamer-view__video' && this.innerHTML.includes('screamer-view__video')) {
        const el = new MockElement('video');
        el.className = 'screamer-view__video';
        el.play = () => Promise.resolve();
        el.pause = () => {};
        el.load = () => {};
        return el;
      }
      if (selector === '#screamer-chroma-canvas' && this.innerHTML.includes('screamer-chroma-canvas')) {
        const el = new MockElement('canvas');
        el.id = 'screamer-chroma-canvas';
        el.style = {};
        el.getContext = () => ({
          drawImage: () => {},
          getImageData: () => ({ data: new Uint8ClampedArray(16) }),
          putImageData: () => {}
        });
        return el;
      }
      if (selector === '.screamer-view__monster' && this.innerHTML.includes('screamer-view__monster')) {
        const el = new MockElement('svg');
        el.className = 'screamer-view__monster';
        el.classList = {
          add: () => {},
          remove: () => {},
          contains: () => false
        };
        return el;
      }
      return null;
    }
  }

  const mockWindow = {
    location: { hash: '#screamer' },
    setTimeout: (fn, delay) => {
      mockWindow._lastTimeoutFn = fn;
      mockWindow._lastDelay = delay;
      return 999;
    },
    clearTimeout: (id) => {
      mockWindow._clearedTimeoutId = id;
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
    _windowListeners: windowListeners
  };

  return {
    mockWindow,
    container: new MockElement('main')
  };
}

describe('ScreamerView Unit Tests (US2.1 / T3)', () => {
  let originalWindow;
  let view;

  beforeEach(() => {
    originalWindow = global.window;
    view = new ScreamerView();
  });

  afterEach(() => {
    if (view) {
      view.unmount();
    }
    if (originalWindow !== undefined) {
      global.window = originalWindow;
    }
  });

  it('should render jumpscare elements, role="alert", chroma canvas, and video element on mount', () => {
    const { mockWindow, container } = createMockDom();
    global.window = mockWindow;

    view.mount(container);

    assert.ok(container.innerHTML.includes('class="screamer-view"'));
    assert.ok(container.innerHTML.includes('role="alert"'));
    assert.ok(container.innerHTML.includes('screamer-view__video'));
    assert.ok(container.innerHTML.includes('screamer-chroma-canvas'));
    assert.ok(container.innerHTML.includes('screamer-view__shake'));
    assert.ok(container.innerHTML.includes('screamer-view__skip-btn'));
  });

  it('should initialise video element with audio unmuted for authentic scare', () => {
    const { mockWindow, container } = createMockDom();
    global.window = mockWindow;

    view.mount(container);

    assert.ok(view.videoElement);
    assert.strictEqual(view.videoElement.muted, false);
    assert.strictEqual(view.videoElement.volume, 1.0);
  });

  it('should set an auto-transition timer to #register for ~3.0s exposure', () => {
    const { mockWindow, container } = createMockDom();
    global.window = mockWindow;

    view.mount(container);

    assert.ok(mockWindow._lastDelay >= 2500 && mockWindow._lastDelay <= 3500);
    assert.strictEqual(mockWindow.location.hash, '#screamer');

    let transitionEventPublished = false;
    const unsub = eventBus.subscribe('screamer:transition-complete', () => {
      transitionEventPublished = true;
    });

    try {
      // Execute the scheduled timeout callback
      mockWindow._lastTimeoutFn();

      assert.strictEqual(mockWindow.location.hash, '#register');
      assert.strictEqual(transitionEventPublished, true);
    } finally {
      unsub();
    }
  });

  it('should transition immediately to #register on Escape key press', () => {
    const { mockWindow, container } = createMockDom();
    global.window = mockWindow;

    view.mount(container);

    const keyListeners = mockWindow._windowListeners.get('keydown') || [];
    assert.ok(keyListeners.length > 0);

    let defaultPrevented = false;
    keyListeners[0]({
      key: 'Escape',
      preventDefault: () => { defaultPrevented = true; }
    });

    assert.strictEqual(defaultPrevented, true);
    assert.strictEqual(mockWindow.location.hash, '#register');
    assert.strictEqual(mockWindow._clearedTimeoutId, 999);
  });

  it('should cleanly unmount, cancel timer, remove listeners, and clear DOM', () => {
    const { mockWindow, container } = createMockDom();
    global.window = mockWindow;

    view.mount(container);
    assert.ok(container.innerHTML.length > 0);

    view.unmount();

    assert.strictEqual(mockWindow._clearedTimeoutId, 999);
    assert.strictEqual(container.innerHTML, '');
    assert.strictEqual(view.container, null);
    assert.strictEqual(mockWindow._windowListeners.get('keydown').length, 0);
  });

  it('should export singleton instance screamerView', async () => {
    const { screamerView: singleton } = await import('../src/views/screamerView.js');
    assert.ok(singleton instanceof ScreamerView);
  });

  it('should register #screamer route in registerApplicationRoutes (US2.1 / T4)', async () => {
    const { registerApplicationRoutes, Router } = await import('../src/app.js');
    const router = new Router();
    registerApplicationRoutes(router);

    assert.ok(router.routes.has('#screamer'));
    assert.strictEqual(router.routes.get('#screamer'), (await import('../src/views/screamerView.js')).screamerView);
  });

  it('should coordinate transition to #screamer when gameView receives game:trigger-screamer (US2.1 / T4)', async () => {
    const { GameView } = await import('../src/views/gameView.js');
    const originalDocument = global.document;

    class MockDocElement {
      constructor(tag) {
        this.tagName = tag.toUpperCase();
        this.id = '';
        this.className = '';
        this.attributes = new Map();
        this.childNodes = [];
        this.classList = {
          add: () => {},
          remove: () => {},
          contains: () => false
        };
      }
      setAttribute(k, v) { this.attributes.set(k, v); }
      getAttribute(k) { return this.attributes.get(k) || null; }
      removeAttribute(k) { this.attributes.delete(k); }
      appendChild(c) { this.childNodes.push(c); return c; }
      addEventListener() {}
      removeEventListener() {}
      querySelectorAll() { return []; }
      querySelector() { return null; }
    }

    const { mockWindow, container } = createMockDom();
    mockWindow.location.hash = '#play';
    global.window = mockWindow;
    global.document = {
      createElement: (t) => new MockDocElement(t)
    };

    const game = new GameView();
    try {
      game.mount(container);
      eventBus.publish('game:trigger-screamer', { reason: 'timer_expired' });
      assert.strictEqual(mockWindow.location.hash, '#screamer');
    } finally {
      game.unmount();
      global.document = originalDocument;
    }
  });
});
