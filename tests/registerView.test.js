/**
 * @file registerView.test.js
 * @description Unit tests for RegisterView component and nickname validation (US2.3 / T5, T6).
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { RegisterView, registerView, validateNickname } from '../src/views/registerView.js';
import { captureService } from '../src/screamer/capture.js';
import { Router, registerApplicationRoutes } from '../src/app.js';
import { eventBus } from '../src/utils/eventBus.js';

/**
 * Lightweight mock DOM for RegisterView testing.
 */
function createMockDom() {
  const elements = new Map();

  class MockElement {
    constructor(tagName, id = '') {
      this.tagName = tagName.toUpperCase();
      this.id = id;
      this.innerHTML = '';
      this.value = '';
      this.textContent = '';
      this.disabled = false;
      this.listeners = new Map();
      this.childNodes = [];
      this.classList = {
        _classes: new Set(),
        add: (...c) => c.forEach((cls) => this.classList._classes.add(cls)),
        remove: (...c) => c.forEach((cls) => this.classList._classes.delete(cls)),
        contains: (cls) => this.classList._classes.has(cls)
      };
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

    dispatchEvent(eventName, eventObj = {}) {
      const handlers = this.listeners.get(eventName) || [];
      for (const handler of handlers) {
        handler(eventObj);
      }
    }

    querySelector(selector) {
      if (!elements.has(selector)) {
        const tag = selector.startsWith('#btn') ? 'button' : (selector.includes('input') ? 'input' : 'div');
        const el = new MockElement(tag, selector.replace('#', ''));
        elements.set(selector, el);
      }
      return elements.get(selector);
    }
  }

  const mockWindow = {
    location: { hash: '#register' }
  };

  return {
    mockWindow,
    container: new MockElement('main', 'app')
  };
}

describe('validateNickname Unit Tests (US2.3 / T6)', () => {
  it('should reject non-string inputs', () => {
    assert.strictEqual(validateNickname(null).isValid, false);
    assert.strictEqual(validateNickname(undefined).isValid, false);
    assert.strictEqual(validateNickname(12345).isValid, false);
  });

  it('should reject empty strings or whitespace-only inputs', () => {
    const emptyResult = validateNickname('');
    assert.strictEqual(emptyResult.isValid, false);
    assert.ok(emptyResult.errorMessage.includes('introduce tu apodo'));

    const whitespaceResult = validateNickname('     ');
    assert.strictEqual(whitespaceResult.isValid, false);
    assert.ok(whitespaceResult.errorMessage.includes('introduce tu apodo'));
  });

  it('should reject strings under 3 characters in length', () => {
    const res1 = validateNickname('a');
    assert.strictEqual(res1.isValid, false);
    assert.ok(res1.errorMessage.includes('al menos 3'));

    const res2 = validateNickname('ab');
    assert.strictEqual(res2.isValid, false);
    assert.ok(res2.errorMessage.includes('al menos 3'));
  });

  it('should reject strings exceeding 20 characters in length', () => {
    const res = validateNickname('123456789012345678901'); // 21 chars
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errorMessage.includes('superar los 20'));
  });

  it('should accept valid nicknames between 3 and 20 characters', () => {
    const resMin = validateNickname('Neo');
    assert.strictEqual(resMin.isValid, true);
    assert.strictEqual(resMin.sanitizedNickname, 'Neo');

    const resMax = validateNickname('12345678901234567890'); // 20 chars
    assert.strictEqual(resMax.isValid, true);
    assert.strictEqual(resMax.sanitizedNickname, '12345678901234567890');

    const resValid = validateNickname('  VampiroDAW  ');
    assert.strictEqual(resValid.isValid, true);
    assert.strictEqual(resValid.sanitizedNickname, 'VampiroDAW');
  });

  it('should strip dangerous HTML injection characters', () => {
    const injection = '<b>Ghoul</b>';
    const res = validateNickname(injection);
    // After stripping <, >, /: bGhoulb (7 chars)
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.sanitizedNickname, 'bGhoulb');
    assert.strictEqual(res.sanitizedNickname.includes('<'), false);
    assert.strictEqual(res.sanitizedNickname.includes('>'), false);
    assert.strictEqual(res.sanitizedNickname.includes('/'), false);
  });
});

describe('RegisterView Component Unit Tests (US2.3 / T5, T6)', () => {
  let originalWindow;
  let view;

  beforeEach(() => {
    originalWindow = global.window;
    view = new RegisterView();
    if (captureService) {
      captureService.clearSnapshot();
    }
  });

  afterEach(() => {
    if (view) {
      view.unmount();
    }
    if (captureService) {
      captureService.clearSnapshot();
    }
    if (originalWindow !== undefined) {
      global.window = originalWindow;
    }
  });

  it('should render gothic Polaroid card, photo preview, and registration form on mount', () => {
    const { mockWindow, container } = createMockDom();
    global.window = mockWindow;

    view.mount(container);

    assert.ok(container.innerHTML.includes('class="polaroid-card"'));
    assert.ok(container.innerHTML.includes('id="reaction-photo-preview"'));
    assert.ok(container.innerHTML.includes('class="register-panel"'));
    assert.ok(container.innerHTML.includes('id="player-nickname"'));
    assert.ok(container.innerHTML.includes('id="btn-immortalise"'));
    assert.ok(container.innerHTML.includes('id="btn-play-again"'));
  });

  it('should display camera photo and photo reaction badge when snapshot exists', () => {
    const { mockWindow, container } = createMockDom();
    global.window = mockWindow;

    const mockPhotoDataUrl = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4WAoAAAAQAAAA';
    captureService.setSnapshot(mockPhotoDataUrl, false);

    view.mount(container);

    assert.ok(container.innerHTML.includes(mockPhotoDataUrl));
    assert.ok(container.innerHTML.includes('📸 Foto Reacción'));
  });

  it('should display fallback avatar and ghost badge when no camera snapshot exists', () => {
    const { mockWindow, container } = createMockDom();
    global.window = mockWindow;

    assert.strictEqual(captureService.hasSnapshot(), false);

    view.mount(container);

    assert.ok(container.innerHTML.includes('🎃 Avatar Fantasmal'));
    assert.ok(container.innerHTML.includes('data:image/svg+xml'));
  });

  it('should navigate to #play and clear snapshot when restart button is clicked', () => {
    const { mockWindow, container } = createMockDom();
    global.window = mockWindow;

    captureService.setSnapshot('data:image/webp;base64,dummy', false);
    assert.strictEqual(captureService.hasSnapshot(), true);

    view.mount(container);
    view.restartGame();

    assert.strictEqual(mockWindow.location.hash, '#play');
    assert.strictEqual(captureService.hasSnapshot(), false);
  });

  it('should update character counter dynamically on input', () => {
    const { mockWindow, container } = createMockDom();
    global.window = mockWindow;

    view.mount(container);

    const input = container.querySelector('#player-nickname');
    const counter = container.querySelector('#nickname-counter');

    input.value = 'BrujaDAW';
    input.dispatchEvent('input');

    assert.strictEqual(counter.textContent, '8 / 20');
  });

  it('should show error and block submission when nickname is invalid', () => {
    const { mockWindow, container } = createMockDom();
    global.window = mockWindow;

    view.mount(container);

    const input = container.querySelector('#player-nickname');
    const feedback = container.querySelector('#nickname-feedback');
    const form = container.querySelector('#register-nickname-form');

    let eventEmitted = false;
    const unsub = eventBus.subscribe('screamer:nickname-submitted', () => {
      eventEmitted = true;
    });

    try {
      input.value = 'no'; // too short (< 3)
      let defaultPrevented = false;
      form.dispatchEvent('submit', { preventDefault: () => { defaultPrevented = true; } });

      assert.strictEqual(defaultPrevented, true);
      assert.strictEqual(eventEmitted, false);
      assert.strictEqual(input.classList.contains('register-form__input--error'), true);
      assert.ok(feedback.textContent.includes('al menos 3'));
    } finally {
      unsub();
    }
  });

  it('should publish screamer:nickname-submitted, disable button, and navigate to #hall-of-fame on valid submit (US2.3 / T6)', () => {
    const { mockWindow, container } = createMockDom();
    global.window = mockWindow;

    captureService.setSnapshot('data:image/webp;base64,sample-reaction', false);
    view.mount(container);

    const input = container.querySelector('#player-nickname');
    const feedback = container.querySelector('#nickname-feedback');
    const submitBtn = container.querySelector('#btn-immortalise');
    const form = container.querySelector('#register-nickname-form');

    let submittedPayload = null;
    const unsub = eventBus.subscribe('screamer:nickname-submitted', (payload) => {
      submittedPayload = payload;
    });

    try {
      input.value = ' Fantasma2026 ';
      form.dispatchEvent('submit', { preventDefault: () => {} });

      assert.ok(submittedPayload !== null);
      assert.strictEqual(submittedPayload.nickname, 'Fantasma2026');
      assert.strictEqual(submittedPayload.photoDataUrl, 'data:image/webp;base64,sample-reaction');
      assert.strictEqual(submittedPayload.isFallback, false);
      assert.ok(typeof submittedPayload.timestamp === 'number');

      assert.strictEqual(submitBtn.disabled, true);
      assert.strictEqual(feedback.textContent, '');
      assert.strictEqual(input.classList.contains('register-form__input--error'), false);
      assert.strictEqual(mockWindow.location.hash, '#hall-of-fame');
    } finally {
      unsub();
    }
  });

  it('should cleanly unmount and reset container', () => {
    const { mockWindow, container } = createMockDom();
    global.window = mockWindow;

    view.mount(container);
    assert.ok(container.innerHTML.length > 0);

    view.unmount();
    assert.strictEqual(container.innerHTML, '');
    assert.strictEqual(view.container, null);
    assert.strictEqual(view.snapshotDataUrl, null);
  });

  it('should export singleton instance registerView and register #register in Router', () => {
    assert.ok(registerView instanceof RegisterView);

    const router = new Router();
    registerApplicationRoutes(router);

    assert.ok(router.routes.has('#register'));
    assert.strictEqual(router.routes.get('#register'), registerView);
  });
});
