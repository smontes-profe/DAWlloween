/**
 * @file alerts.test.js
 * @description Unit tests for AlertService module.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AlertService } from '../src/ui/alerts.js';
import { EventBus } from '../src/utils/eventBus.js';

/**
 * Minimal lightweight DOM mock for headless testing of AlertService.
 */
function createMockDom() {
  const elements = new Map();

  class MockElement {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.id = '';
      this.className = '';
      this.classList = {
        _classes: new Set(),
        add: (...cls) => cls.forEach((c) => this.classList._classes.add(c)),
        remove: (...cls) => cls.forEach((c) => this.classList._classes.delete(c)),
        contains: (c) => this.classList._classes.has(c)
      };
      this.attributes = new Map();
      this.childNodes = [];
      this.parentNode = null;
      this.textContent = '';
      this.innerHTML = '';
      this.listeners = new Map();
    }

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }

    getAttribute(name) {
      return this.attributes.get(name) || null;
    }

    appendChild(child) {
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }

    removeChild(child) {
      const index = this.childNodes.indexOf(child);
      if (index !== -1) {
        this.childNodes.splice(index, 1);
        child.parentNode = null;
      }
      return child;
    }

    contains(child) {
      if (!child) return false;
      if (this.childNodes.includes(child)) return true;
      return this.childNodes.some((c) => typeof c.contains === 'function' && c.contains(child));
    }

    addEventListener(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }

    removeEventListener(event, callback) {
      if (this.listeners.has(event)) {
        const arr = this.listeners.get(event);
        const idx = arr.indexOf(callback);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }

    dispatchEvent(event) {
      const arr = this.listeners.get(event.type) || [];
      for (const cb of arr) {
        cb(event);
      }
    }
  }

  const body = new MockElement('BODY');

  const doc = {
    body,
    createElement: (tag) => new MockElement(tag),
    querySelector: (selector) => {
      if (selector === '#toast-container' || selector === '.toast-container') {
        return body.childNodes.find((node) => node.id === 'toast-container') || null;
      }
      return null;
    }
  };

  return { doc, body };
}

describe('AlertService Unit Tests', () => {
  let mockEnv;
  let originalDocument;

  beforeEach(() => {
    mockEnv = createMockDom();
    originalDocument = globalThis.document;
    globalThis.document = mockEnv.doc;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('should auto-create accessible #toast-container if not found in DOM', () => {
    const service = new AlertService('#toast-container');
    const container = service.ensureContainer();

    assert.ok(container);
    assert.equal(container.id, 'toast-container');
    assert.equal(container.getAttribute('role'), 'region');
    assert.equal(container.getAttribute('aria-label'), 'System Notifications');
    assert.equal(container.getAttribute('aria-live'), 'polite');
  });

  it('should create and mount a toast element with title, message and icon', () => {
    const service = new AlertService();
    const toast = service.show({
      message: 'Ghost detected in the arena!',
      title: 'Supernatural Alert',
      type: 'warning',
      duration: 0
    });

    assert.ok(toast);
    assert.ok(toast.className.includes('toast--warning'));
    assert.equal(toast.getAttribute('role'), 'alert'); // Warning/error has alert role

    const host = service.ensureContainer();
    assert.ok(host.childNodes.includes(toast));

    // Content check
    const contentChild = toast.childNodes.find((c) => c.className === 'toast__content');
    assert.ok(contentChild);
    const titleEl = contentChild.childNodes.find((c) => c.className === 'toast__title');
    assert.equal(titleEl.textContent, 'Supernatural Alert');
    const msgEl = contentChild.childNodes.find((c) => c.className === 'toast__message');
    assert.equal(msgEl.textContent, 'Ghost detected in the arena!');
  });

  it('should support shortcut helpers (info, success, warning, error)', () => {
    const service = new AlertService();

    const infoToast = service.info('Test Info');
    assert.ok(infoToast.className.includes('toast--info'));
    assert.equal(infoToast.getAttribute('role'), 'status');

    const successToast = service.success('Test Success');
    assert.ok(successToast.className.includes('toast--success'));

    const errorToast = service.error('Test Error');
    assert.ok(errorToast.className.includes('toast--error'));
    assert.equal(errorToast.getAttribute('role'), 'alert');
  });

  it('should dismiss toast element and remove from DOM', () => {
    const service = new AlertService();
    const toast = service.show({ message: 'Temporary message', duration: 0 });
    const host = service.ensureContainer();

    assert.ok(host.childNodes.includes(toast));

    service.dismiss(toast);
    assert.ok(toast.classList.contains('toast--closing'));

    // Trigger animationend to complete unmounting
    toast.dispatchEvent({ type: 'animationend' });
    assert.equal(host.childNodes.includes(toast), false);
  });

  it('should return null when message is empty or document is undefined', () => {
    const service = new AlertService();
    assert.equal(service.show(''), null);
    assert.equal(service.show({ message: '' }), null);
    assert.equal(service.show(null), null);
  });
});
