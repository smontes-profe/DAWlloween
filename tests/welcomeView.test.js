/**
 * @file welcomeView.test.js
 * @description Unit tests for WelcomeView component.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { WelcomeView } from '../src/views/welcomeView.js';
import { cameraService } from '../src/screamer/camera.js';
import { alerts } from '../src/ui/alerts.js';
import { audioService } from '../src/services/audio.js';

/**
 * Lightweight DOM mock for WelcomeView testing.
 */
function createMockDom() {
  class MockElement {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.id = '';
      this.className = '';
      this.style = {};
      this.attributes = new Map();
      this.childNodes = [];
      this.parentNode = null;
      this.textContent = '';
      this.classList = {
        _classes: new Set(),
        add: (...c) => c.forEach((cls) => this.classList._classes.add(cls)),
        remove: (...c) => c.forEach((cls) => this.classList._classes.delete(cls)),
        contains: (cls) => this.classList._classes.has(cls)
      };
      this.listeners = new Map();
      this.disabled = false;
    }

    setAttribute(k, v) {
      this.attributes.set(k, String(v));
    }

    getAttribute(k) {
      return this.attributes.get(k) || null;
    }

    removeAttribute(k) {
      this.attributes.delete(k);
    }

    appendChild(child) {
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }

    removeChild(child) {
      const idx = this.childNodes.indexOf(child);
      if (idx !== -1) {
        this.childNodes.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    }

    addEventListener(evt, fn) {
      if (!this.listeners.has(evt)) this.listeners.set(evt, []);
      this.listeners.get(evt).push(fn);
    }

    removeEventListener(evt, fn) {
      if (this.listeners.has(evt)) {
        const arr = this.listeners.get(evt);
        const idx = arr.indexOf(fn);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }

    querySelector(selector) {
      return this._findChild((node) => {
        if (selector.startsWith('#') && node.id === selector.slice(1)) return true;
        if (selector.startsWith('.') && node.className.includes(selector.slice(1))) return true;
        return false;
      });
    }

    _findChild(predicate) {
      for (const child of this.childNodes) {
        if (predicate(child)) return child;
        if (typeof child._findChild === 'function') {
          const match = child._findChild(predicate);
          if (match) return match;
        }
      }
      return null;
    }
  }

  const body = new MockElement('BODY');
  const container = new MockElement('MAIN');
  container.id = 'app';
  body.appendChild(container);

  const doc = {
    body,
    createElement: (tag) => new MockElement(tag),
    querySelector: (selector) => {
      if (selector === '#app') return container;
      if (selector === '#toast-container' || selector === '.toast-container') {
        return body.querySelector(selector);
      }
      return null;
    }
  };

  const win = {
    location: { hash: '#home' }
  };

  return { doc, win, container, body };
}

describe('WelcomeView Unit Tests', () => {
  let mockEnv;
  let originalDocument;
  let originalWindow;
  let originalRequestPermission;

  beforeEach(() => {
    mockEnv = createMockDom();
    originalDocument = globalThis.document;
    originalWindow = globalThis.window;
    originalRequestPermission = cameraService.requestPermission;
    globalThis.document = mockEnv.doc;
    globalThis.window = mockEnv.win;
  });

  afterEach(() => {
    alerts.clearAll();
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    cameraService.requestPermission = originalRequestPermission;
  });

  it('should render hero title, briefing cards, and calibrate button upon mount', () => {
    const view = new WelcomeView();
    view.mount(mockEnv.container);

    assert.equal(mockEnv.container.childNodes.length, 1);
    const wrapper = mockEnv.container.childNodes[0];
    assert.equal(wrapper.className.includes('welcome-view'), true);

    const title = wrapper.querySelector('#welcome-title');
    assert.ok(title);
    assert.equal(title.textContent, 'DAWlloween: Night of the Dead');

    const startBtn = wrapper.querySelector('#btn-start-game');
    assert.ok(startBtn);
    const textSpan = startBtn.querySelector('.btn-arcade__text');
    assert.equal(textSpan.textContent, 'Calibrate & Enter the Arena');
  });

  it('should initialise audio, request camera permission, and navigate to #play upon successful calibration', async () => {
    let permissionRequested = false;
    let audioInitialised = false;
    const originalInit = audioService.initialise;
    audioService.initialise = () => {
      audioInitialised = true;
      return true;
    };

    cameraService.requestPermission = async () => {
      permissionRequested = true;
      return { success: true, stream: {} };
    };

    try {
      const view = new WelcomeView();
      view.mount(mockEnv.container);

      const success = await view.handleStartExperience();

      assert.equal(audioInitialised, true);
      assert.equal(permissionRequested, true);
      assert.equal(success, true);
      assert.equal(mockEnv.win.location.hash, '#play');
    } finally {
      audioService.initialise = originalInit;
    }
  });

  it('should reset button state when camera calibration fails or is denied', async () => {
    cameraService.requestPermission = async () => {
      return { success: false, error: new Error('Denied') };
    };

    const view = new WelcomeView();
    view.mount(mockEnv.container);

    const success = await view.handleStartExperience();

    assert.equal(success, false);
    assert.notEqual(mockEnv.win.location.hash, '#play');
    assert.equal(view.startButton.disabled, false);
    const textSpan = view.startButton.querySelector('.btn-arcade__text');
    assert.equal(textSpan.textContent, 'Calibrate & Enter the Arena');
  });

  it('should cleanly unmount and remove elements from the container', () => {
    const view = new WelcomeView();
    view.mount(mockEnv.container);
    assert.equal(mockEnv.container.childNodes.length, 1);

    view.unmount();
    assert.equal(mockEnv.container.childNodes.length, 0);
    assert.equal(view.rootElement, null);
    assert.equal(view.startButton, null);
  });
});
