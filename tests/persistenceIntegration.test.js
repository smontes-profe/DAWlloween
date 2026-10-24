/**
 * @file persistenceIntegration.test.js
 * @description End-to-end integration tests for Cloud Persistence and Resilience pipeline (US3.3 / T8).
 * Verifies RegisterView form submission, media asset storage, database insertion,
 * retry resilience on simulated microcuts, and router navigation to #hall-of-fame.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { RegisterView } from '../src/views/registerView.js';
import { captureService, generateFallbackAvatar } from '../src/screamer/capture.js';
import { recorderService } from '../src/screamer/recorder.js';
import { supabaseService, MockSupabaseClient } from '../src/services/supabase.js';
import { eventBus } from '../src/utils/eventBus.js';
import { alerts } from '../src/ui/alerts.js';

/**
 * Lightweight mock DOM environment for end-to-end persistence integration testing.
 */
function createIntegrationMockDom() {
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
      this.attributes = new Map();
      this.classList = {
        _classes: new Set(),
        add: (...c) => c.forEach((cls) => this.classList._classes.add(cls)),
        remove: (...c) => c.forEach((cls) => this.classList._classes.delete(cls)),
        contains: (cls) => this.classList._classes.has(cls)
      };
    }

    setAttribute(key, value) {
      this.attributes.set(key, String(value));
    }

    getAttribute(key) {
      return this.attributes.get(key) || null;
    }

    removeAttribute(key) {
      this.attributes.delete(key);
    }

    focus() {
      // noop
    }

    contains(child) {
      return true;
    }

    appendChild(child) {
      this.childNodes.push(child);
      return child;
    }

    removeChild(child) {
      this.childNodes = this.childNodes.filter((c) => c !== child);
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

  const container = new MockElement('MAIN', 'app');
  const body = new MockElement('BODY', 'body');
  const mockDocument = {
    body,
    getElementById(id) {
      return container.querySelector(`#${id}`);
    },
    querySelector(selector) {
      return container.querySelector(selector);
    },
    querySelectorAll(selector) {
      const el = container.querySelector(selector);
      return el ? [el] : [];
    },
    createElement(tagName) {
      return new MockElement(tagName);
    }
  };
  const mockWindow = {
    location: { hash: '#register' }
  };

  return { container, mockWindow, mockDocument, elements };
}

describe('Cloud Persistence E2E Integration Pipeline (US3.3 / T8)', () => {
  let mockDom;
  let mockClient;
  let view;
  let originalWindow;
  let originalDocument;

  beforeEach(() => {
    mockDom = createIntegrationMockDom();
    originalWindow = globalThis.window;
    originalDocument = globalThis.document;
    globalThis.window = mockDom.mockWindow;
    globalThis.document = mockDom.mockDocument;

    mockClient = new MockSupabaseClient({
      url: 'https://e2e-dawlloween.supabase.co',
      anonKey: 'e2e-anon-key',
      storageBucket: 'reactions',
      tableName: 'hall_of_fame',
      maxRetries: 2,
      retryDelayMs: 15
    });

    supabaseService.client = mockClient;
    supabaseService.status = 'MOCK';
    supabaseService._isMockInstance = true;
    supabaseService.config = {
      url: 'https://e2e-dawlloween.supabase.co',
      anonKey: 'e2e-anon-key',
      storageBucket: 'reactions',
      tableName: 'hall_of_fame',
      maxRetries: 2,
      retryDelayMs: 15
    };

    view = new RegisterView();
    eventBus.clear();
  });

  afterEach(() => {
    if (view) {
      view.unmount();
    }
    if (recorderService) {
      recorderService.clearRecording();
    }
    if (captureService) {
      captureService.clearSnapshot();
    }
    if (alerts && typeof alerts.clearAll === 'function') {
      alerts.clearAll();
    }
    supabaseService.reset();
    eventBus.clear();
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  });

  it('should execute full E2E pipeline with video recording: form submit -> storage upload -> database insert -> router transition', async () => {
    // 1. Arrange: setup video recording and photo snapshot
    const mockWebmBlob = new Blob(['mock-webm-video-bytes'], { type: 'video/webm' });
    recorderService.recordedChunks = [mockWebmBlob];
    recorderService.currentVideoBlob = mockWebmBlob;
    recorderService.recordedMimeType = 'video/webm';
    recorderService.currentVideoUrl = 'blob:http://localhost/mock-video-url';

    captureService.setSnapshot('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=', false);

    // 2. Mount RegisterView
    view.mount(mockDom.container);

    const input = mockDom.container.querySelector('#player-nickname');
    const submitBtn = mockDom.container.querySelector('#btn-immortalise');
    assert.ok(input);
    assert.ok(submitBtn);

    input.value = ' VampiroDigital ';

    // Listen to persistence events
    const persistedEvents = [];
    const unsub = eventBus.subscribe('screamer:persisted', (payload) => {
      persistedEvents.push(payload);
    });

    // 3. Act: Submit registration
    const record = await view.handleSubmit();

    // 4. Assert: Database and Storage records
    assert.ok(record, 'Record should be persisted');
    assert.equal(record.nickname, 'VampiroDigital');
    assert.ok(record.video_url.includes('reactions/reaction_'));
    assert.ok(record.video_url.endsWith('.webm'));
    assert.ok(record.photo_url.includes('reactions/reaction_'));
    assert.ok(record.photo_url.endsWith('.webp'));
    assert.ok(record.created_at);

    // Verify storage bucket has both video and photo
    const bucket = mockClient.storageData.get('reactions');
    assert.equal(bucket.size, 2, 'Should upload both video and photo');

    // Verify database table
    const table = mockClient.tableData.get('hall_of_fame');
    assert.equal(table.length, 1);
    assert.equal(table[0].nickname, 'VampiroDigital');

    // Verify event bus payload
    assert.equal(persistedEvents.length, 1);
    assert.equal(persistedEvents[0].nickname, 'VampiroDigital');
    assert.ok(persistedEvents[0].hasVideo);

    // Verify router transitioned
    assert.equal(mockDom.mockWindow.location.hash, '#hall-of-fame');
    unsub();
  });

  it('should execute fallback E2E pipeline when video recording is unavailable (photo snapshot only)', async () => {
    // 1. Arrange: No video, only fallback photo
    recorderService.clearRecording();
    const fallbackPhoto = generateFallbackAvatar();
    captureService.setSnapshot(fallbackPhoto, true);

    view.mount(mockDom.container);

    const input = mockDom.container.querySelector('#player-nickname');
    input.value = 'EspectroNovato';

    // 2. Act
    const record = await view.handleSubmit();

    // 3. Assert
    assert.ok(record);
    assert.equal(record.nickname, 'EspectroNovato');
    assert.equal(record.video_url, null, 'Video URL must be null for photo-only submissions');
    assert.ok(record.photo_url.includes('reactions/reaction_'));

    const bucket = mockClient.storageData.get('reactions');
    assert.equal(bucket.size, 1, 'Should upload only photo');

    const table = mockClient.tableData.get('hall_of_fame');
    assert.equal(table.length, 1);
    assert.equal(table[0].video_url, null);

    assert.equal(mockDom.mockWindow.location.hash, '#hall-of-fame');
  });

  it('should successfully recover from transient network drops via automatic retry and conclude transaction', async () => {
    recorderService.clearRecording();
    captureService.setSnapshot('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=', false);

    view.mount(mockDom.container);
    const input = mockDom.container.querySelector('#player-nickname');
    input.value = 'ResilientPlayer';

    // Intercept upload to fail once before succeeding
    let uploadAttempts = 0;
    const realUpload = mockClient.storage.from('reactions').upload;
    mockClient.storage.from = (bucket) => ({
      upload: async (path, file, opts) => {
        uploadAttempts++;
        if (uploadAttempts === 1) {
          return { data: null, error: new Error('Temporary 503 Server Gateway Drop') };
        }
        return { data: { path }, error: null };
      },
      getPublicUrl: (path) => ({
        data: { publicUrl: `https://e2e-dawlloween.supabase.co/storage/v1/object/public/${bucket}/${path}` }
      })
    });

    const retryEvents = [];
    const unsub = eventBus.subscribe('storage:retry', (e) => retryEvents.push(e));

    const record = await view.handleSubmit();

    assert.ok(record);
    assert.equal(uploadAttempts, 2, 'Should succeed on retry attempt');
    assert.ok(retryEvents.length >= 1, 'Should emit retry event to notify user');
    assert.equal(mockDom.mockWindow.location.hash, '#hall-of-fame');

    unsub();
  });

  it('should alert player, stay on view, and re-enable submit button if cloud outage is permanent', async () => {
    mockClient._simulateUploadFailure = true;

    recorderService.clearRecording();
    captureService.setSnapshot('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=', false);

    view.mount(mockDom.container);
    const input = mockDom.container.querySelector('#player-nickname');
    const submitBtn = mockDom.container.querySelector('#btn-immortalise');
    input.value = 'StuckPlayer';

    const result = await view.handleSubmit();

    // 1. Transaction failed
    assert.equal(result, null);

    // 2. User did NOT navigate away
    assert.equal(mockDom.mockWindow.location.hash, '#register');

    // 3. Button and input are re-enabled for player manual retry
    assert.equal(submitBtn.disabled, false);
    assert.equal(input.disabled, false);
  });

  it('should strictly maintain zero local persistence across the entire pipeline', async () => {
    // Check global storage APIs
    const hasLocalStorage = typeof localStorage !== 'undefined';
    const hasSessionStorage = typeof sessionStorage !== 'undefined';

    const initialLocalKeys = hasLocalStorage ? Object.keys(localStorage).length : 0;
    const initialSessionKeys = hasSessionStorage ? Object.keys(sessionStorage).length : 0;

    recorderService.clearRecording();
    captureService.setSnapshot('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=', false);

    view.mount(mockDom.container);
    const input = mockDom.container.querySelector('#player-nickname');
    input.value = 'PrivacyAdvocate';

    await view.handleSubmit();

    const finalLocalKeys = hasLocalStorage ? Object.keys(localStorage).length : 0;
    const finalSessionKeys = hasSessionStorage ? Object.keys(sessionStorage).length : 0;

    assert.equal(finalLocalKeys, initialLocalKeys, 'localStorage must not be populated');
    assert.equal(finalSessionKeys, initialSessionKeys, 'sessionStorage must not be populated');
  });
});
