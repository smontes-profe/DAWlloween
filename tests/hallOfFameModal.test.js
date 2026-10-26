/**
 * @file hallOfFameModal.test.js
 * @description Unit tests for accessible reaction media enlargement modal dialog in Hall of Fame (US6.4 / T7).
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { HallOfFameView } from '../src/views/hallOfFameView.js';

/**
 * Creates lightweight mock DOM environment for HallOfFameView headless testing.
 */
function createMockDom() {
  class MockElement {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.id = '';
      this.className = '';
      this.type = '';
      this.src = '';
      this.autoplay = false;
      this.loop = false;
      this.playsInline = false;
      this.controls = false;
      this.preload = '';
      this.innerHTML = '';
      this._textContent = '';
      this.style = {};
      this.attributes = new Map();
      this.childNodes = [];
      this.parentNode = null;
      this._isPaused = true;
      this._focused = false;
      this.classList = {
        _classes: new Set(),
        add: (...c) => c.forEach((cls) => this.classList._classes.add(cls)),
        remove: (...c) => c.forEach((cls) => this.classList._classes.delete(cls)),
        contains: (cls) => this.classList._classes.has(cls)
      };
      this.listeners = new Map();
    }

    get textContent() {
      return this._textContent;
    }

    set textContent(v) {
      this._textContent = String(v);
    }

    focus() {
      this._focused = true;
    }

    pause() {
      this._isPaused = true;
    }

    play() {
      this._isPaused = false;
      return Promise.resolve();
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

    remove() {
      if (this.parentNode) {
        this.parentNode.removeChild(this);
      }
    }

    closest(selector) {
      let current = this;
      while (current) {
        if (selector.startsWith('#') && current.id === selector.slice(1)) return current;
        if (selector.startsWith('.') && (current.className.includes(selector.slice(1)) || current.classList.contains(selector.slice(1)))) return current;
        if (selector.startsWith('[data-') && current.attributes) {
          const attrMatch = selector.match(/\[([a-zA-Z0-9_-]+)="?([^"\]]*)"?\]/);
          if (attrMatch && current.getAttribute(attrMatch[1]) === attrMatch[2]) {
            return current;
          }
          const plainAttr = selector.replace(/[[\]]/g, '');
          if (current.attributes.has(plainAttr)) {
            return current;
          }
        }
        current = current.parentNode;
      }
      return null;
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

    async dispatchEvent(event) {
      const type = event.type;
      if (this.listeners.has(type)) {
        for (const fn of this.listeners.get(type)) {
          await fn(event);
        }
      }
    }

    querySelector(selector) {
      if (selector === '#hall-grid-container' && !this._grid) {
        const existing = this._findChild((n) => n.id === 'hall-grid-container');
        if (existing) return existing;
        this._grid = new MockElement('DIV');
        this._grid.id = 'hall-grid-container';
        this.appendChild(this._grid);
        return this._grid;
      }

      return this._findChild((node) => {
        if (selector.startsWith('#') && node.id === selector.slice(1)) return true;
        if (selector.includes('.')) {
          const [tag, cls] = selector.split('.');
          const tagMatches = !tag || node.tagName.toLowerCase() === tag.toLowerCase();
          const classMatches = node.className.includes(cls) || node.classList.contains(cls);
          if (tagMatches && classMatches) return true;
        } else if (selector.startsWith('.') && (node.className.includes(selector.slice(1)) || node.classList.contains(selector.slice(1)))) {
          return true;
        }
        if (selector.startsWith('[data-') && node.attributes) {
          const attrMatch = selector.match(/\[([a-zA-Z0-9_-]+)="?([^"\]]*)"?\]/);
          if (attrMatch && node.getAttribute(attrMatch[1]) === attrMatch[2]) return true;
          const plainAttr = selector.replace(/[[\]]/g, '');
          if (node.attributes.has(plainAttr)) return true;
        }
        if (node.tagName.toLowerCase() === selector.toLowerCase()) return true;
        return false;
      });
    }

    querySelectorAll(selector) {
      const results = [];
      this._walkChildren((node) => {
        if (selector.startsWith('#') && node.id === selector.slice(1)) results.push(node);
        else if (selector.startsWith('.') && (node.className.includes(selector.slice(1)) || node.classList.contains(selector.slice(1)))) results.push(node);
        else if (node.tagName.toLowerCase() === selector.toLowerCase()) results.push(node);
      });
      return results;
    }

    _walkChildren(visitor) {
      for (const child of this.childNodes) {
        visitor(child);
        if (typeof child._walkChildren === 'function') {
          child._walkChildren(visitor);
        }
      }
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

  const docListeners = new Map();
  const body = new MockElement('BODY');
  const container = new MockElement('MAIN');
  container.id = 'app';
  body.appendChild(container);

  const doc = {
    body,
    createElement: (tag) => new MockElement(tag),
    querySelector: (selector) => {
      if (selector === '#app') return container;
      if (selector === 'body') return body;
      return body.querySelector(selector);
    },
    querySelectorAll: (selector) => body.querySelectorAll(selector),
    addEventListener: (evt, fn) => {
      if (!docListeners.has(evt)) docListeners.set(evt, []);
      docListeners.get(evt).push(fn);
    },
    removeEventListener: (evt, fn) => {
      if (docListeners.has(evt)) {
        const arr = docListeners.get(evt);
        const idx = arr.indexOf(fn);
        if (idx !== -1) arr.splice(idx, 1);
      }
    },
    dispatchEvent: async (event) => {
      const type = event.type;
      if (docListeners.has(type)) {
        for (const fn of docListeners.get(type)) {
          await fn(event);
        }
      }
    }
  };

  return { doc, body, container };
}

describe('Hall of Fame Video Enlargement Modal (US6.4 / T7)', () => {
  let mockEnv;
  let originalDocument;
  let originalWindow;
  let sampleReactions;
  let mockSupabase;
  let mockAuth;

  beforeEach(() => {
    mockEnv = createMockDom();
    originalDocument = globalThis.document;
    originalWindow = globalThis.window;
    globalThis.document = mockEnv.doc;
    globalThis.window = {
      location: { reload: () => {} },
      IntersectionObserver: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    };

    sampleReactions = [
      {
        id: 'rec-1',
        nickname: 'VampiroDAW',
        video_url: 'https://cdn.supabase.co/vampiro.webm',
        photo_url: 'https://cdn.supabase.co/vampiro.webp',
        created_at: new Date(Date.now() - 5000).toISOString()
      },
      {
        id: 'rec-2',
        nickname: 'BrujaJS',
        video_url: null,
        photo_url: 'https://cdn.supabase.co/bruja.webp',
        created_at: new Date(Date.now() - 120000).toISOString()
      }
    ];

    mockSupabase = {
      fetchHallOfFame: async () => sampleReactions,
      deleteReactionRecord: async () => true
    };

    mockAuth = {
      isAuthenticated: () => false,
      logout: () => {}
    };
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  });

  it('should open media enlargement modal when openMediaModal is called with valid record ID', () => {
    const view = new HallOfFameView({
      supabaseService: mockSupabase,
      authService: mockAuth,
      enablePolling: false
    });
    view.reactions = [...sampleReactions];

    view.openMediaModal('rec-1');

    const backdrop = mockEnv.body.querySelector('#modal-media-backdrop');
    assert.ok(backdrop, 'Media modal backdrop should be appended to document.body');

    const dialog = backdrop.querySelector('.media-modal-dialog');
    assert.ok(dialog, 'Dialog container should exist inside backdrop');
    assert.equal(dialog.getAttribute('role'), 'dialog');
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    assert.equal(dialog.getAttribute('aria-labelledby'), 'media-modal-title');

    const title = dialog.querySelector('#media-modal-title');
    assert.ok(title);
    assert.match(title.textContent, /VampiroDAW/);

    const video = dialog.querySelector('video.media-modal-player');
    assert.ok(video, 'Modal should render video element when record has video_url');
    assert.equal(video.src, 'https://cdn.supabase.co/vampiro.webm');
    assert.equal(video.autoplay, true);
    assert.equal(video.controls, true);
  });

  it('should render image fallback in modal when reaction only has photo_url', () => {
    const view = new HallOfFameView({
      supabaseService: mockSupabase,
      authService: mockAuth,
      enablePolling: false
    });
    view.reactions = [...sampleReactions];

    view.openMediaModal('rec-2');

    const dialog = mockEnv.body.querySelector('.media-modal-dialog');
    assert.ok(dialog);

    const img = dialog.querySelector('img.media-modal-image');
    assert.ok(img, 'Modal should render image element when video_url is null');
    assert.equal(img.src, 'https://cdn.supabase.co/bruja.webp');
    assert.match(img.alt, /BrujaJS/);
  });

  it('should dismiss modal when clicking close "X" button', async () => {
    const view = new HallOfFameView({
      supabaseService: mockSupabase,
      authService: mockAuth,
      enablePolling: false
    });
    view.reactions = [...sampleReactions];

    view.openMediaModal('rec-1');
    assert.ok(mockEnv.body.querySelector('#modal-media-backdrop'));

    const closeBtn = mockEnv.body.querySelector('#btn-media-modal-close');
    assert.ok(closeBtn, 'Close button must exist in modal header');

    await closeBtn.dispatchEvent({ type: 'click' });

    assert.equal(mockEnv.body.querySelector('#modal-media-backdrop'), null, 'Backdrop should be removed from DOM upon close');
    assert.equal(view.activeModal, null);
  });

  it('should dismiss modal when clicking on backdrop outside dialog', async () => {
    const view = new HallOfFameView({
      supabaseService: mockSupabase,
      authService: mockAuth,
      enablePolling: false
    });
    view.reactions = [...sampleReactions];

    view.openMediaModal('rec-1');
    const backdrop = mockEnv.body.querySelector('#modal-media-backdrop');
    assert.ok(backdrop);

    await backdrop.dispatchEvent({ type: 'click', target: backdrop });

    assert.equal(mockEnv.body.querySelector('#modal-media-backdrop'), null);
  });

  it('should dismiss modal when pressing Escape key', async () => {
    const view = new HallOfFameView({
      supabaseService: mockSupabase,
      authService: mockAuth,
      enablePolling: false
    });
    view.reactions = [...sampleReactions];

    view.openMediaModal('rec-1');
    assert.ok(mockEnv.body.querySelector('#modal-media-backdrop'));

    await mockEnv.doc.dispatchEvent({ type: 'keydown', key: 'Escape' });

    assert.equal(mockEnv.body.querySelector('#modal-media-backdrop'), null);
  });

  it('should delegate click on reaction-card to open media modal without interfering with admin delete button', async () => {
    mockAuth.isAuthenticated = () => true;

    const view = new HallOfFameView({
      supabaseService: mockSupabase,
      authService: mockAuth,
      enablePolling: false
    });

    const host = mockEnv.doc.createElement('div');
    mockEnv.body.appendChild(host);
    await view.mount(host);

    const gridContainer = host.querySelector('#hall-grid-container');
    assert.ok(gridContainer);

    // Simulate clicking card body
    const card = mockEnv.doc.createElement('article');
    card.className = 'reaction-card';
    card.setAttribute('data-id', 'rec-1');
    gridContainer.appendChild(card);

    let openedId = null;
    view.openMediaModal = (id) => {
      openedId = id;
    };

    await gridContainer.dispatchEvent({
      type: 'click',
      target: card,
      preventDefault: () => {}
    });

    assert.equal(openedId, 'rec-1', 'Clicking card must trigger openMediaModal with card ID');

    // Simulate clicking delete button inside card
    const deleteBtn = mockEnv.doc.createElement('button');
    deleteBtn.setAttribute('data-action', 'delete');
    deleteBtn.setAttribute('data-id', 'rec-1');
    deleteBtn.setAttribute('data-nickname', 'VampiroDAW');
    card.appendChild(deleteBtn);

    let deleteModalOpened = false;
    view.openDeleteConfirmationModal = () => {
      deleteModalOpened = true;
    };
    openedId = null;

    await gridContainer.dispatchEvent({
      type: 'click',
      target: deleteBtn,
      preventDefault: () => {},
      stopPropagation: () => {}
    });

    assert.equal(deleteModalOpened, true, 'Clicking delete button must trigger delete confirmation');
    assert.equal(openedId, null, 'Clicking delete button must NOT trigger openMediaModal');
  });

  it('should trigger openMediaModal via keyboard activation (Enter or Space) on reaction-card', async () => {
    const view = new HallOfFameView({
      supabaseService: mockSupabase,
      authService: mockAuth,
      enablePolling: false
    });

    const host = mockEnv.doc.createElement('div');
    mockEnv.body.appendChild(host);
    await view.mount(host);

    const gridContainer = host.querySelector('#hall-grid-container');
    assert.ok(gridContainer);

    const card = mockEnv.doc.createElement('article');
    card.className = 'reaction-card';
    card.setAttribute('data-id', 'rec-1');
    gridContainer.appendChild(card);

    let openedId = null;
    view.openMediaModal = (id) => {
      openedId = id;
    };

    await gridContainer.dispatchEvent({
      type: 'keydown',
      key: 'Enter',
      target: card,
      preventDefault: () => {}
    });

    assert.equal(openedId, 'rec-1', 'Enter key must trigger openMediaModal');

    openedId = null;
    await gridContainer.dispatchEvent({
      type: 'keydown',
      key: ' ',
      target: card,
      preventDefault: () => {}
    });

    assert.equal(openedId, 'rec-1', 'Space key must trigger openMediaModal');
  });

  it('should clean up open modal and listeners when destroy is invoked', () => {
    const view = new HallOfFameView({
      supabaseService: mockSupabase,
      authService: mockAuth,
      enablePolling: false
    });
    view.reactions = [...sampleReactions];

    view.openMediaModal('rec-1');
    assert.ok(mockEnv.body.querySelector('#modal-media-backdrop'));

    view.destroy();

    assert.equal(mockEnv.body.querySelector('#modal-media-backdrop'), null, 'Modal must be removed on destroy');
    assert.equal(view.boundGridClickHandler, null);
    assert.equal(view.boundGridKeyHandler, null);
    assert.equal(view.boundModalKeyHandler, null);
  });
});
