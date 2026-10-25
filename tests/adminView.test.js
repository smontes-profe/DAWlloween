/**
 * @file adminView.test.js
 * @description Unit tests for AdminAuthService and AdminView component (US6.1 / T1).
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AdminAuthService, adminAuth } from '../src/services/adminAuth.js';
import { AdminView, adminView } from '../src/views/adminView.js';
import { HallOfFameView } from '../src/views/hallOfFameView.js';
import { eventBus } from '../src/utils/eventBus.js';
import { alerts } from '../src/ui/alerts.js';

/**
 * Creates lightweight mock DOM environment for AdminView headless tests.
 */
function createMockDom() {
  class MockElement {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.id = '';
      this.className = '';
      this.name = '';
      this.type = '';
      this.value = '';
      this.placeholder = '';
      this.required = false;
      this.autocomplete = '';
      this.htmlFor = '';
      this.href = '';
      this.innerHTML = '';
      this._textContent = '';
      this.style = {};
      this.attributes = new Map();
      this.childNodes = [];
      this.parentNode = null;
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

    dispatchEvent(event) {
      const type = event.type;
      if (this.listeners.has(type)) {
        for (const fn of this.listeners.get(type)) {
          fn(event);
        }
      }
    }

    querySelector(selector) {
      return this._findChild((node) => {
        if (selector.startsWith('#') && node.id === selector.slice(1)) return true;
        if (selector.startsWith('.') && (node.className.includes(selector.slice(1)) || node.classList.contains(selector.slice(1)))) return true;
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
    dispatchEvent: (event) => {
      if (docListeners.has(event.type)) {
        for (const fn of docListeners.get(event.type)) fn(event);
      }
    }
  };

  const win = {
    location: { hash: '#admin' }
  };

  return { doc, win, container, body };
}

describe('AdminAuthService & AdminView Unit Tests (US6.1 / T1)', () => {
  let originalDocument;
  let originalWindow;

  beforeEach(() => {
    originalDocument = globalThis.document;
    originalWindow = globalThis.window;
    adminAuth.reset();
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    adminAuth.reset();
  });

  describe('AdminAuthService in-memory authentication', () => {
    it('should reject login with empty or missing credentials', () => {
      const auth = new AdminAuthService();
      let failedEvent = null;
      const unsub = eventBus.subscribe('admin:login-failed', (e) => {
        failedEvent = e;
      });

      assert.equal(auth.login('', ''), false);
      assert.equal(auth.isAuthenticated(), false);
      assert.ok(failedEvent);
      assert.equal(failedEvent.reason, 'EMPTY_CREDENTIALS');

      unsub();
    });

    it('should reject login with invalid password', () => {
      const auth = new AdminAuthService({ username: 'admin', password: 'secretpassword' });
      let failedEvent = null;
      const unsub = eventBus.subscribe('admin:login-failed', (e) => {
        failedEvent = e;
      });

      assert.equal(auth.login('admin', 'wrongpass'), false);
      assert.equal(auth.isAuthenticated(), false);
      assert.ok(failedEvent);
      assert.equal(failedEvent.reason, 'INVALID_CREDENTIALS');

      unsub();
    });

    it('should successfully establish in-memory session with matching credentials and emit event', () => {
      const auth = new AdminAuthService({ username: 'admin', password: 'correctpassword' });
      let successEvent = null;
      const unsub = eventBus.subscribe('admin:login-success', (e) => {
        successEvent = e;
      });

      assert.equal(auth.login('admin', 'correctpassword'), true);
      assert.equal(auth.isAuthenticated(), true);
      assert.equal(auth.getUsername(), 'admin');
      assert.ok(successEvent);
      assert.equal(successEvent.username, 'admin');

      unsub();
    });

    it('should cleanly terminate session upon logout and emit logged-out event', () => {
      const auth = new AdminAuthService({ username: 'moderator', password: 'pwd' });
      auth.login('moderator', 'pwd');
      assert.equal(auth.isAuthenticated(), true);

      let logoutEvent = null;
      const unsub = eventBus.subscribe('admin:logged-out', (e) => {
        logoutEvent = e;
      });

      auth.logout();
      assert.equal(auth.isAuthenticated(), false);
      assert.equal(auth.getUsername(), null);
      assert.ok(logoutEvent);
      assert.equal(logoutEvent.username, 'moderator');

      unsub();
    });
  });

  describe('AdminView Component Lifecycle & Form Handling', () => {
    it('should throw an error if mount container is not provided', () => {
      const view = new AdminView();
      assert.throws(() => view.mount(null), /Mount container must be provided/);
    });

    it('should render the login form when unauthenticated', () => {
      const { doc, win, container } = createMockDom();
      globalThis.document = doc;
      globalThis.window = win;

      const view = new AdminView({ authService: adminAuth });
      view.mount(container);

      const form = container.querySelector('#admin-login-form');
      assert.ok(form, 'Should render login form element');

      const userInput = container.querySelector('#admin-username');
      assert.ok(userInput, 'Should have username input');
      assert.equal(userInput.type, 'text');

      const passInput = container.querySelector('#admin-password');
      assert.ok(passInput, 'Should have password input');
      assert.equal(passInput.type, 'password');

      const submitBtn = container.querySelector('#admin-login-submit');
      assert.ok(submitBtn, 'Should have submit button');
    });

    it('should display error message on empty credentials submit', () => {
      const { doc, win, container } = createMockDom();
      globalThis.document = doc;
      globalThis.window = win;

      const view = new AdminView({ authService: adminAuth });
      view.mount(container);

      const form = container.querySelector('#admin-login-form');
      const feedback = container.querySelector('#admin-feedback');

      let prevented = false;
      form.dispatchEvent({
        type: 'submit',
        preventDefault: () => {
          prevented = true;
        }
      });

      assert.equal(prevented, true);
      assert.match(feedback.textContent, /introduce el usuario y la contraseña/i);
      assert.ok(feedback.classList.contains('admin-feedback--error'));
    });

    it('should display error feedback and alert on invalid credentials submit', () => {
      const { doc, win, container } = createMockDom();
      globalThis.document = doc;
      globalThis.window = win;

      const customAuth = new AdminAuthService({ username: 'admin', password: 'secretpassword' });
      const view = new AdminView({ authService: customAuth });
      view.mount(container);

      const form = container.querySelector('#admin-login-form');
      const userInput = container.querySelector('#admin-username');
      const passInput = container.querySelector('#admin-password');
      const feedback = container.querySelector('#admin-feedback');

      userInput.value = 'admin';
      passInput.value = 'wrongpassword';

      let alertErrorCalled = false;
      const originalAlertError = alerts.error;
      alerts.error = (msg) => {
        alertErrorCalled = true;
      };

      form.dispatchEvent({
        type: 'submit',
        preventDefault: () => {}
      });

      alerts.error = originalAlertError;

      assert.match(feedback.textContent, /Credenciales incorrectas/i);
      assert.ok(feedback.classList.contains('admin-feedback--error'));
      assert.equal(passInput.value, '');
      assert.equal(passInput._focused, true);
      assert.equal(alertErrorCalled, true);
    });

    it('should successfully log in and redirect to #hall-of-fame on valid credentials', () => {
      const { doc, win, container } = createMockDom();
      globalThis.document = doc;
      globalThis.window = win;

      const customAuth = new AdminAuthService({ username: 'admin', password: 'validpassword' });
      const view = new AdminView({ authService: customAuth });
      view.mount(container);

      const form = container.querySelector('#admin-login-form');
      const userInput = container.querySelector('#admin-username');
      const passInput = container.querySelector('#admin-password');

      userInput.value = 'admin';
      passInput.value = 'validpassword';

      let alertSuccessCalled = false;
      const originalAlertSuccess = alerts.success;
      alerts.success = (msg) => {
        alertSuccessCalled = true;
      };

      form.dispatchEvent({
        type: 'submit',
        preventDefault: () => {}
      });

      alerts.success = originalAlertSuccess;

      assert.equal(customAuth.isAuthenticated(), true);
      assert.equal(win.location.hash, '#hall-of-fame');
      assert.equal(alertSuccessCalled, true);
    });

    it('should render active session controls when already authenticated and support logout', () => {
      const { doc, win, container } = createMockDom();
      globalThis.document = doc;
      globalThis.window = win;

      const customAuth = new AdminAuthService({ username: 'teacher', password: 'pwd' });
      customAuth.login('teacher', 'pwd');

      const view = new AdminView({ authService: customAuth });
      view.mount(container);

      const hallBtn = container.querySelector('#admin-btn-hall');
      const logoutBtn = container.querySelector('#admin-btn-logout');

      assert.ok(hallBtn, 'Should render Hall of Fame navigation button');
      assert.ok(logoutBtn, 'Should render Logout button');

      // Test Hall button click
      hallBtn.dispatchEvent({ type: 'click' });
      assert.equal(win.location.hash, '#hall-of-fame');

      // Test Logout click
      logoutBtn.dispatchEvent({ type: 'click' });
      assert.equal(customAuth.isAuthenticated(), false);

      // Re-rendered to show login form
      const form = container.querySelector('#admin-login-form');
      assert.ok(form, 'Should re-render login form after logout');
    });

    it('should cleanly unmount and clear container', () => {
      const { doc, win, container } = createMockDom();
      globalThis.document = doc;
      globalThis.window = win;

      const view = new AdminView({ authService: adminAuth });
      view.mount(container);

      assert.ok(container.childNodes.length > 0);
      view.unmount();
      assert.equal(container.innerHTML, '');
      assert.equal(view.container, null);
    });
  });

  describe('HallOfFameView Admin Moderation & Deletion (US6.1 / T2)', () => {
    it('should not render admin bar or delete buttons when unauthenticated', () => {
      const unauthenticatedAuth = new AdminAuthService({ username: 'admin', password: 'pwd' });
      assert.equal(unauthenticatedAuth.isAuthenticated(), false);

      const hallView = new HallOfFameView({
        authService: unauthenticatedAuth,
        enablePolling: false
      });

      const adminControls = hallView.renderAdminControls();
      assert.equal(adminControls, '');

      const cardHtml = hallView.renderReactionCard({
        id: 'rec-1',
        nickname: 'Victim1',
        video_url: 'https://xyz.supabase.co/reactions/v1.webm'
      });

      assert.equal(cardHtml.includes('btn-reaction-delete'), false);
      assert.equal(cardHtml.includes('🗑️ Eliminar'), false);
    });

    it('should render admin toolbar with logout button and individual delete buttons when authenticated', () => {
      const authenticatedAuth = new AdminAuthService({ username: 'moderator', password: 'pwd' });
      authenticatedAuth.login('moderator', 'pwd');
      assert.equal(authenticatedAuth.isAuthenticated(), true);

      const hallView = new HallOfFameView({
        authService: authenticatedAuth,
        enablePolling: false
      });

      const adminControls = hallView.renderAdminControls();
      assert.ok(adminControls.includes('hall-controls__admin-bar'));
      assert.ok(adminControls.includes('Modo Moderador'));
      assert.ok(adminControls.includes('btn-admin-logout'));
      assert.ok(adminControls.includes('Cerrar Sesión'));

      const cardHtml = hallView.renderReactionCard({
        id: 'rec-101',
        nickname: 'CourageousStudent',
        video_url: 'https://xyz.supabase.co/reactions/v101.webm'
      });

      assert.ok(cardHtml.includes('btn-reaction-delete'));
      assert.ok(cardHtml.includes('data-action="delete"'));
      assert.ok(cardHtml.includes('data-id="rec-101"'));
      assert.ok(cardHtml.includes('Eliminar reacción de CourageousStudent'));
    });

    it('should open confirmation modal with participant nickname and delete warning in es-ES', () => {
      const { doc, win } = createMockDom();
      globalThis.document = doc;
      globalThis.window = win;

      const authenticatedAuth = new AdminAuthService();
      authenticatedAuth._isAuthenticated = true;

      const hallView = new HallOfFameView({ authService: authenticatedAuth });
      hallView.reactions = [
        { id: 'rec-202', nickname: 'BraveGamer', video_url: 'https://xyz/v2.webm' }
      ];

      hallView.openDeleteConfirmationModal('rec-202', 'BraveGamer', null);

      assert.ok(hallView.activeModal);
      const modal = doc.body.querySelector('.modal-dialog');
      assert.ok(modal, 'Modal dialog should be appended to document.body');
      assert.equal(modal.getAttribute('role'), 'dialog');
      assert.equal(modal.getAttribute('aria-modal'), 'true');

      const modalTitle = doc.body.querySelector('#modal-delete-title');
      assert.ok(modalTitle);
      assert.match(modalTitle.textContent, /¿Eliminar reacción\?/i);

      const questionText = modal.querySelector('p');
      assert.ok(questionText && questionText.innerHTML.includes('BraveGamer'));
      assert.equal(modal.querySelector('#modal-btn-confirm').textContent, 'Eliminar Definitivamente');
      assert.equal(modal.querySelector('#modal-btn-cancel').textContent, 'Cancelar');

      hallView.closeModal();
      assert.equal(hallView.activeModal, null);
    });

    it('should close confirmation modal without deleting when cancel button is clicked', () => {
      const { doc, win } = createMockDom();
      globalThis.document = doc;
      globalThis.window = win;

      let deleteRecordCalled = false;
      const mockSupabase = {
        deleteReactionRecord: async () => {
          deleteRecordCalled = true;
        }
      };

      const hallView = new HallOfFameView({ supabaseService: mockSupabase });
      hallView.openDeleteConfirmationModal('rec-303', 'PlayerToKeep', null);

      const cancelBtn = doc.body.querySelector('#modal-btn-cancel');
      assert.ok(cancelBtn);

      cancelBtn.dispatchEvent({ type: 'click' });

      assert.equal(hallView.activeModal, null);
      assert.equal(deleteRecordCalled, false);
    });

    it('should close confirmation modal when Escape key is pressed', () => {
      const { doc, win } = createMockDom();
      globalThis.document = doc;
      globalThis.window = win;

      const hallView = new HallOfFameView();
      hallView.openDeleteConfirmationModal('rec-303', 'EscapeTest', null);
      assert.ok(hallView.activeModal);

      doc.dispatchEvent({ type: 'keydown', key: 'Escape' });
      assert.equal(hallView.activeModal, null);
    });

    it('should call deleteReactionRecord, remove card element, update count, and show success alert on confirm', async () => {
      const { doc, win } = createMockDom();
      globalThis.document = doc;
      globalThis.window = win;

      let deletedParams = null;
      const mockSupabase = {
        deleteReactionRecord: async (id, media) => {
          deletedParams = { id, media };
          return { id, storageDeleted: [], storageErrors: [] };
        }
      };

      let successAlertMsg = null;
      const mockAlerts = {
        success: (msg) => {
          successAlertMsg = msg;
        },
        info: () => {},
        error: () => {}
      };

      const hallView = new HallOfFameView({
        supabaseService: mockSupabase,
        alertsService: mockAlerts
      });

      const fakeCard = doc.createElement('div');
      fakeCard.className = 'reaction-card';
      fakeCard.setAttribute('data-id', 'rec-404');
      doc.body.appendChild(fakeCard);

      hallView.reactions = [
        { id: 'rec-404', nickname: 'TargetToDelete', video_url: 'v.webm', photo_url: 'p.webp' },
        { id: 'rec-505', nickname: 'Survivor', video_url: 's.webm', photo_url: null }
      ];
      hallView.knownReactionIds = new Set(['rec-404', 'rec-505']);

      hallView.openDeleteConfirmationModal('rec-404', 'TargetToDelete', fakeCard);

      const confirmBtn = doc.body.querySelector('#modal-btn-confirm');
      assert.ok(confirmBtn);

      await confirmBtn.dispatchEvent({ type: 'click' });

      // Assert Supabase delete call
      assert.ok(deletedParams);
      assert.equal(deletedParams.id, 'rec-404');
      assert.equal(deletedParams.media.videoUrl, 'v.webm');
      assert.equal(deletedParams.media.photoUrl, 'p.webp');

      // Assert DOM removal and state update
      assert.equal(fakeCard.parentNode, null, 'Fake card element should be removed from parent');
      assert.equal(hallView.reactions.length, 1);
      assert.equal(hallView.reactions[0].id, 'rec-505');
      assert.equal(hallView.knownReactionIds.has('rec-404'), false);
      assert.match(successAlertMsg, /Reacción eliminada permanentemente/i);
    });

    it('should reactively remove reaction card upon EventBus hall-of-fame:record-deleted event', async () => {
      const { doc, win, container } = createMockDom();
      globalThis.document = doc;
      globalThis.window = win;

      const mockSupabase = {
        fetchHallOfFame: async () => [
          { id: 'event-del-1', nickname: 'GhostA', video_url: 'a.webm' },
          { id: 'event-del-2', nickname: 'GhostB', video_url: 'b.webm' }
        ]
      };

      const hallView = new HallOfFameView({
        supabaseService: mockSupabase,
        enablePolling: false
      });

      await hallView.mount(container);

      // Verify mounting registered eventBus subscriber
      assert.ok(hallView.eventBusUnsubscribe);

      // Emit event
      eventBus.publish('hall-of-fame:record-deleted', { id: 'event-del-1' });

      assert.equal(hallView.reactions.length, 1);
      assert.equal(hallView.reactions[0].id, 'event-del-2');

      hallView.destroy();
    });
  });
});
