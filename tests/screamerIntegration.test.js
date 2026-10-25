/**
 * @file screamerIntegration.test.js
 * @description Integration tests for jumpscare reaction recording, Polaroid preview,
 * and nickname submission lifecycle (US2.4 / T9).
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/game/engine.js';
import { recorderService } from '../src/screamer/recorder.js';
import { captureService } from '../src/screamer/capture.js';
import { RegisterView } from '../src/views/registerView.js';
import { eventBus } from '../src/utils/eventBus.js';

/**
 * Mock MediaStream implementation.
 */
class MockStream {
  constructor() {
    this.active = true;
    this.tracks = [{ stop: () => {} }];
  }
  getTracks() {
    return this.tracks;
  }
}

/**
 * Mock MediaRecorder implementation.
 */
class MockMediaRecorder {
  static supportedMimes = new Set(['video/webm;codecs=vp8,opus', 'video/webm']);

  static isTypeSupported(mime) {
    return MockMediaRecorder.supportedMimes.has(mime);
  }

  constructor(stream, opts = {}) {
    this.stream = stream;
    this.mimeType = opts.mimeType || 'video/webm';
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    if (typeof this.ondataavailable === 'function') {
      const chunk = new Blob(['sample-video-stream-bytes'], { type: this.mimeType });
      this.ondataavailable({ data: chunk });
    }
    if (typeof this.onstop === 'function') {
      this.onstop();
    }
  }
}

/**
 * Mock DOM element factory.
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

  return {
    container: new MockElement('main', 'app'),
    window: {
      location: { hash: '#screamer' }
    }
  };
}

describe('Screamer to Registration Integration Tests (US2.4 / T9)', () => {
  let originalMediaRecorder;
  let originalUrl;
  let originalWindow;
  let revokedUrls;

  beforeEach(() => {
    originalMediaRecorder = global.MediaRecorder;
    originalUrl = global.URL;
    originalWindow = global.window;
    revokedUrls = [];

    global.MediaRecorder = MockMediaRecorder;
    global.URL = {
      createObjectURL: (blob) => `blob:http://localhost:3000/scare-${Date.now()}-${blob.type}`,
      revokeObjectURL: (url) => {
        revokedUrls.push(url);
      }
    };
  });

  afterEach(() => {
    recorderService.clearRecording();
    recorderService.detachRecorderListener();
    captureService.clearSnapshot();
    captureService.detachCaptureListener();

    global.MediaRecorder = originalMediaRecorder;
    global.URL = originalUrl;
    if (originalWindow !== undefined) {
      global.window = originalWindow;
    }
  });

  it('should seamlessly execute the entire chain: trigger -> video recorded -> preview -> nickname submission ready for EPIC3', () => {
    const mockDom = createMockDom();
    global.window = mockDom.window;

    // 1. Initialise services and listeners
    const mockStream = new MockStream();
    recorderService.initialiseRecorderListener();
    // Intercept startRecording stream provision
    const originalStart = recorderService.startRecording.bind(recorderService);
    recorderService.startRecording = (opts) => originalStart({ stream: mockStream, ...opts });

    captureService.setSnapshot('data:image/webp;base64,fallback-snapshot-test', false);

    // Track decoupled events across the EventBus
    const receivedEvents = {};
    const unsubs = [
      eventBus.subscribe('game:trigger-screamer', (d) => { receivedEvents['trigger-screamer'] = d; }),
      eventBus.subscribe('screamer:video-recorded', (d) => { receivedEvents['video-recorded'] = d; }),
      eventBus.subscribe('screamer:nickname-submitted', (d) => { receivedEvents['nickname-submitted'] = d; })
    ];

    try {
      // 2. Trigger jumpscare climax from GameEngine
      const engine = new GameEngine({ survivalDuration: 1 });
      engine.state = 'RUNNING';
      engine.triggerClimax('timer_expired', 3000);

      assert.ok(receivedEvents['trigger-screamer']);
      assert.strictEqual(receivedEvents['trigger-screamer'].reason, 'timer_expired');

      // 3. Jumpscare visual playback starts and triggers recorder
      eventBus.publish('screamer:playback-started', { durationMs: 3000 });
      assert.strictEqual(recorderService.isRecording, true);

      // Simulate completion of 2-second recording
      recorderService.stopRecording();

      assert.ok(receivedEvents['video-recorded']);
      assert.strictEqual(receivedEvents['video-recorded'].isFallback, false);
      assert.ok(receivedEvents['video-recorded'].blob instanceof Blob);
      assert.ok(receivedEvents['video-recorded'].url.startsWith('blob:http://localhost:3000/scare-'));
      assert.strictEqual(recorderService.hasRecording(), true);

      // 4. Mount RegisterView on #register
      const registerView = new RegisterView();
      registerView.mount(mockDom.container);

      // Verify Polaroid frame renders the video reaction element
      assert.ok(mockDom.container.innerHTML.includes('id="reaction-video-preview"'));
      assert.ok(mockDom.container.innerHTML.includes('🎬 Vídeo Reacción'));
      assert.ok(mockDom.container.innerHTML.includes('polaroid-card__badge--video'));

      // 5. Submit valid nickname
      const input = mockDom.container.querySelector('#player-nickname');
      const form = mockDom.container.querySelector('#register-nickname-form');
      input.value = 'SpookyGamer26';

      form.dispatchEvent('submit', { preventDefault: () => {} });

      // 6. Validate screamer:nickname-submitted payload is prepared for Supabase
      const submission = receivedEvents['nickname-submitted'];
      assert.ok(submission !== null);
      assert.strictEqual(submission.nickname, 'SpookyGamer26');
      assert.ok(submission.videoBlob instanceof Blob);
      assert.strictEqual(submission.hasVideo, true);
      assert.ok(submission.mimeType.includes('video/webm'));
      assert.strictEqual(submission.isFallback, false);
      assert.ok(typeof submission.timestamp === 'number');

      // 7. Test cleanup and zero local persistence
      const activeVideoUrl = recorderService.getVideoUrl();
      registerView.unmount();

      assert.ok(revokedUrls.includes(activeVideoUrl));
      assert.strictEqual(recorderService.getVideoBlob(), null);
      assert.strictEqual(recorderService.getVideoUrl(), null);
      assert.strictEqual(recorderService.hasRecording(), false);
    } finally {
      unsubs.forEach((unsub) => unsub());
    }
  });
});
