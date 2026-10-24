/**
 * @file recorder.test.js
 * @description Unit tests for ReactionRecorderService (US2.4 / T7).
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ReactionRecorderService,
  DEFAULT_RECORDING_DURATION_MS,
  getSupportedVideoMimeType
} from '../src/screamer/recorder.js';
import { eventBus } from '../src/utils/eventBus.js';

/**
 * Mock MediaStream implementation for testing.
 */
class MockMediaStream {
  constructor() {
    this.active = true;
    this.tracks = [{ kind: 'video', stop: () => {} }];
  }
  getTracks() {
    return this.tracks;
  }
}

/**
 * Mock MediaRecorder implementation for testing.
 */
class MockMediaRecorder {
  static supportedMimes = new Set(['video/webm', 'video/webm;codecs=vp8,opus']);

  static isTypeSupported(mime) {
    return MockMediaRecorder.supportedMimes.has(mime);
  }

  constructor(stream, options = {}) {
    this.stream = stream;
    this.mimeType = options.mimeType || 'video/webm';
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.onerror = null;
  }

  start(timeslice) {
    this.state = 'recording';
    this.timeslice = timeslice;
  }

  stop() {
    this.state = 'inactive';
    if (typeof this.ondataavailable === 'function') {
      const mockChunk = new Blob(['mock-video-bytes'], { type: this.mimeType });
      this.ondataavailable({ data: mockChunk });
    }
    if (typeof this.onstop === 'function') {
      this.onstop();
    }
  }
}

describe('ReactionRecorderService Unit Tests (US2.4 / T7)', () => {
  let originalMediaRecorder;
  let originalUrl;
  let service;

  beforeEach(() => {
    originalMediaRecorder = global.MediaRecorder;
    originalUrl = global.URL;

    global.MediaRecorder = MockMediaRecorder;
    global.URL = {
      createObjectURL: (blob) => `blob:mock-url-${blob.type}`,
      revokeObjectURL: () => {}
    };

    service = new ReactionRecorderService();
  });

  afterEach(() => {
    if (service) {
      service.clearRecording();
      service.detachRecorderListener();
    }
    global.MediaRecorder = originalMediaRecorder;
    global.URL = originalUrl;
  });

  it('should detect supported video MIME types using getSupportedVideoMimeType', () => {
    const mime = getSupportedVideoMimeType();
    assert.strictEqual(mime, 'video/webm;codecs=vp8,opus');
  });

  it('should start recording, collect chunks, and emit screamer:video-recorded upon stop', () => {
    const mockStream = new MockMediaStream();
    let emittedEvent = null;

    const unsub = eventBus.subscribe('screamer:video-recorded', (data) => {
      emittedEvent = data;
    });

    try {
      const started = service.startRecording({ stream: mockStream, durationMs: 2000 });
      assert.strictEqual(started, true);
      assert.strictEqual(service.isRecording, true);
      assert.ok(service.mediaRecorder);
      assert.strictEqual(service.mediaRecorder.state, 'recording');

      // Stop recording
      service.stopRecording();

      assert.strictEqual(service.isRecording, false);
      assert.ok(service.hasRecording());
      assert.ok(service.getVideoBlob() instanceof Blob);
      assert.ok(service.getVideoUrl().startsWith('blob:mock-url-'));
      assert.ok(emittedEvent !== null);
      assert.strictEqual(emittedEvent.isFallback, false);
      assert.strictEqual(emittedEvent.durationMs, 2000);
    } finally {
      unsub();
    }
  });

  it('should automatically engage fallback if stream is missing or inactive', () => {
    let emittedEvent = null;
    const unsub = eventBus.subscribe('screamer:video-recorded', (data) => {
      emittedEvent = data;
    });

    try {
      const started = service.startRecording({ stream: null });
      assert.strictEqual(started, false);
      assert.ok(emittedEvent !== null);
      assert.strictEqual(emittedEvent.isFallback, true);
    } finally {
      unsub();
    }
  });

  it('should automatically engage fallback if MediaRecorder is unsupported', () => {
    delete global.MediaRecorder;
    const mockStream = new MockMediaStream();

    let emittedEvent = null;
    const unsub = eventBus.subscribe('screamer:video-recorded', (data) => {
      emittedEvent = data;
    });

    try {
      const started = service.startRecording({ stream: mockStream });
      assert.strictEqual(started, false);
      assert.ok(emittedEvent !== null);
      assert.strictEqual(emittedEvent.isFallback, true);
    } finally {
      unsub();
    }
  });

  it('should automatically trigger recording on game:trigger-screamer when listener is initialised', () => {
    const mockStream = new MockMediaStream();
    // Provide stream through service
    service.startRecording = function (opts) {
      this.isRecording = true;
      this.lastDurationMs = opts?.durationMs;
      return true;
    };

    service.initialiseRecorderListener();

    eventBus.publish('game:trigger-screamer', { reason: 'timer_expired' });

    assert.strictEqual(service.isRecording, true);
    assert.strictEqual(service.lastDurationMs, DEFAULT_RECORDING_DURATION_MS);
  });

  it('should clean up in-memory blob and revoke object URL on clearRecording() for zero persistence', () => {
    let revokedUrl = null;
    global.URL.revokeObjectURL = (url) => {
      revokedUrl = url;
    };

    const mockStream = new MockMediaStream();
    service.startRecording({ stream: mockStream });
    service.stopRecording();

    assert.ok(service.getVideoUrl());
    const previewUrl = service.getVideoUrl();

    service.clearRecording();

    assert.strictEqual(revokedUrl, previewUrl);
    assert.strictEqual(service.getVideoBlob(), null);
    assert.strictEqual(service.getVideoUrl(), null);
    assert.strictEqual(service.hasRecording(), false);
  });
});
