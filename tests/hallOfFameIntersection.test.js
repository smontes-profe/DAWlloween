/**
 * @file hallOfFameIntersection.test.js
 * @description Unit tests for HallOfFameView video IntersectionObserver lifecycle, auto-play/pause,
 *              cleanup mechanics, and responsive 2-column mobile CSS styles (US5.3 / T8).
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { HallOfFameView } from '../src/views/hallOfFameView.js';

/**
 * Creates a lightweight DOM mock element for unit testing.
 *
 * @param {string} tagName - Tag name in lower or upper case.
 * @returns {object} Mock DOM element.
 */
function createMockElement(tagName = 'div') {
  const upperTag = tagName.toUpperCase();
  const children = [];
  const listeners = new Map();

  return {
    tagName: upperTag,
    innerHTML: '',
    className: '',
    children,
    paused: true,
    playCount: 0,
    pauseCount: 0,
    shouldRejectPlay: false,

    classList: {
      _classes: new Set(),
      add(...tokens) {
        tokens.forEach((t) => this._classes.add(t));
      },
      remove(...tokens) {
        tokens.forEach((t) => this._classes.delete(t));
      },
      contains(t) {
        return this._classes.has(t);
      }
    },

    play() {
      this.playCount++;
      this.paused = false;
      if (this.shouldRejectPlay) {
        return Promise.reject(new Error('Autoplay blocked by browser policy'));
      }
      return Promise.resolve();
    },

    pause() {
      this.pauseCount++;
      this.paused = true;
    },

    appendChild(child) {
      children.push(child);
      return child;
    },

    addEventListener(event, handler) {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event).push(handler);
    },

    removeEventListener(event, handler) {
      if (listeners.has(event)) {
        const list = listeners.get(event);
        const idx = list.indexOf(handler);
        if (idx !== -1) list.splice(idx, 1);
      }
    },

    querySelector(selector) {
      if (selector === 'video') {
        return children.find((c) => c.tagName === 'VIDEO') || null;
      }
      if (selector === 'img') {
        return children.find((c) => c.tagName === 'IMG') || null;
      }
      return null;
    },

    querySelectorAll(selector) {
      if (selector === '.reaction-card') {
        return children.filter((c) => c.className && c.className.includes('reaction-card'));
      }
      return [];
    }
  };
}

/**
 * Mock implementation of IntersectionObserver.
 */
class MockIntersectionObserver {
  constructor(callback, options = {}) {
    this.callback = callback;
    this.options = options;
    this.observedElements = [];
    this.disconnected = false;
    MockIntersectionObserver.instances.push(this);
  }

  observe(target) {
    if (!this.observedElements.includes(target)) {
      this.observedElements.push(target);
    }
  }

  unobserve(target) {
    const idx = this.observedElements.indexOf(target);
    if (idx !== -1) {
      this.observedElements.splice(idx, 1);
    }
  }

  disconnect() {
    this.observedElements = [];
    this.disconnected = true;
  }

  /**
   * Test helper to trigger intersection changes.
   *
   * @param {Array<{target: object, isIntersecting: boolean}>} entries
   */
  trigger(entries) {
    this.callback(entries, this);
  }
}

MockIntersectionObserver.instances = [];

describe('Hall of Fame Video IntersectionObserver Unit Tests (US5.3 / T8)', () => {
  let originalWindow;
  let originalDocument;
  let mockContainer;

  beforeEach(() => {
    MockIntersectionObserver.instances = [];

    // Setup global window and document mocks
    originalWindow = global.window;
    originalDocument = global.document;

    global.window = {
      IntersectionObserver: MockIntersectionObserver
    };

    global.document = {
      hidden: false,
      addEventListener() {},
      removeEventListener() {}
    };

    mockContainer = createMockElement('div');
  });

  afterEach(() => {
    global.window = originalWindow;
    global.document = originalDocument;
    MockIntersectionObserver.instances = [];
  });

  it('should instantiate IntersectionObserver with threshold 0.25 and null root', () => {
    const view = new HallOfFameView({ enablePolling: false });
    view.container = mockContainer;
    view.setupVideoIntersectionObserver();

    assert.ok(view.videoObserver, 'Expected videoObserver instance to be created');
    assert.equal(MockIntersectionObserver.instances.length, 1);

    const observerInstance = MockIntersectionObserver.instances[0];
    assert.equal(observerInstance.options.threshold, 0.25, 'Expected threshold to be 0.25');
    assert.equal(observerInstance.options.root, null, 'Expected root to be null for viewport observation');
  });

  it('should observe only reaction cards that contain a video element', () => {
    const view = new HallOfFameView({ enablePolling: false });
    view.container = mockContainer;

    // Create cards: 2 with video, 1 with image only
    const cardVideo1 = createMockElement('div');
    cardVideo1.className = 'reaction-card';
    const video1 = createMockElement('video');
    cardVideo1.appendChild(video1);

    const cardVideo2 = createMockElement('div');
    cardVideo2.className = 'reaction-card';
    const video2 = createMockElement('video');
    cardVideo2.appendChild(video2);

    const cardPhotoOnly = createMockElement('div');
    cardPhotoOnly.className = 'reaction-card';
    const photo = createMockElement('img');
    cardPhotoOnly.appendChild(photo);

    mockContainer.appendChild(cardVideo1);
    mockContainer.appendChild(cardPhotoOnly);
    mockContainer.appendChild(cardVideo2);

    view.setupVideoIntersectionObserver();

    const observerInstance = MockIntersectionObserver.instances[0];
    assert.equal(observerInstance.observedElements.length, 2, 'Should observe exactly 2 video cards');
    assert.ok(observerInstance.observedElements.includes(cardVideo1));
    assert.ok(observerInstance.observedElements.includes(cardVideo2));
    assert.ok(!observerInstance.observedElements.includes(cardPhotoOnly));
  });

  it('should play video when card enters viewport and pause when it leaves viewport', () => {
    const view = new HallOfFameView({ enablePolling: false });
    view.container = mockContainer;

    const card = createMockElement('div');
    card.className = 'reaction-card';
    const video = createMockElement('video');
    card.appendChild(video);
    mockContainer.appendChild(card);

    view.setupVideoIntersectionObserver();
    const observerInstance = MockIntersectionObserver.instances[0];

    assert.equal(video.playCount, 0);
    assert.equal(video.pauseCount, 0);

    // 1. Enter viewport
    observerInstance.trigger([{ target: card, isIntersecting: true }]);
    assert.equal(video.playCount, 1, 'Expected video.play() to be called on entry');
    assert.equal(video.paused, false);

    // 2. Leave viewport
    observerInstance.trigger([{ target: card, isIntersecting: false }]);
    assert.equal(video.pauseCount, 1, 'Expected video.pause() to be called on exit');
    assert.equal(video.paused, true);
  });

  it('should defensively handle autoplay Promise rejections without crashing', async () => {
    const view = new HallOfFameView({ enablePolling: false });
    view.container = mockContainer;

    const card = createMockElement('div');
    card.className = 'reaction-card';
    const video = createMockElement('video');
    video.shouldRejectPlay = true; // Simulates browser rejecting unmuted autoplay
    card.appendChild(video);
    mockContainer.appendChild(card);

    view.setupVideoIntersectionObserver();
    const observerInstance = MockIntersectionObserver.instances[0];

    // Trigger intersection - must not throw uncaught error
    assert.doesNotThrow(() => {
      observerInstance.trigger([{ target: card, isIntersecting: true }]);
    });

    assert.equal(video.playCount, 1);
  });

  it('should cleanly disconnect observer on destroy() and set videoObserver to null', () => {
    const view = new HallOfFameView({ enablePolling: false });
    view.container = mockContainer;
    view.setupVideoIntersectionObserver();

    const observerInstance = MockIntersectionObserver.instances[0];
    assert.equal(observerInstance.disconnected, false);

    view.destroy();

    assert.equal(observerInstance.disconnected, true, 'Expected observer.disconnect() on destroy');
    assert.equal(view.videoObserver, null, 'Expected view.videoObserver to be cleared to null');
  });

  it('should disconnect prior observer when setupVideoIntersectionObserver is called repeatedly', () => {
    const view = new HallOfFameView({ enablePolling: false });
    view.container = mockContainer;
    view.setupVideoIntersectionObserver();

    const firstObserver = MockIntersectionObserver.instances[0];
    assert.equal(firstObserver.disconnected, false);

    view.setupVideoIntersectionObserver();

    assert.equal(firstObserver.disconnected, true, 'First observer must be disconnected');
    assert.equal(MockIntersectionObserver.instances.length, 2);
    assert.equal(MockIntersectionObserver.instances[1].disconnected, false);
  });

  it('should degrade gracefully when window.IntersectionObserver is undefined', () => {
    global.window.IntersectionObserver = undefined;

    const view = new HallOfFameView({ enablePolling: false });
    view.container = mockContainer;

    assert.doesNotThrow(() => {
      view.setupVideoIntersectionObserver();
      view.destroy();
    });

    assert.equal(view.videoObserver, null);
  });
});

describe('Hall of Fame 2-Column Mobile CSS Specification Tests (US5.3 / T8)', () => {
  let cssContent;

  beforeEach(() => {
    const cssPath = path.resolve(process.cwd(), 'styles/hallOfFame.css');
    cssContent = fs.readFileSync(cssPath, 'utf8');
  });

  it('should specify 2-column grid layout as default base for .hall-grid', () => {
    assert.ok(
      cssContent.includes('.hall-grid {'),
      'Expected .hall-grid class definition in hallOfFame.css'
    );
    assert.ok(
      cssContent.includes('grid-template-columns: repeat(2, 1fr)'),
      'Expected default 2-column grid layout via repeat(2, 1fr)'
    );
  });

  it('should contain compact mobile media query (max-width: 767px)', () => {
    assert.ok(
      cssContent.includes('@media (max-width: 767px)'),
      'Expected @media (max-width: 767px) breakpoint in hallOfFame.css'
    );
  });

  it('should define tablet media query (min-width: 768px) with auto-fill expansion', () => {
    assert.ok(
      cssContent.includes('@media (min-width: 768px)'),
      'Expected @media (min-width: 768px) breakpoint in hallOfFame.css'
    );
    assert.ok(
      cssContent.includes('grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))'),
      'Expected auto-fill grid expansion for tablet breakpoint'
    );
  });

  it('should define desktop media query (min-width: 1024px) for expansive monitors', () => {
    assert.ok(
      cssContent.includes('@media (min-width: 1024px)'),
      'Expected @media (min-width: 1024px) breakpoint in hallOfFame.css'
    );
    assert.ok(
      cssContent.includes('grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))'),
      'Expected auto-fill grid expansion for desktop breakpoint'
    );
  });
});
