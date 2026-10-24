/**
 * @file capture.test.js
 * @description Unit tests for ReactionCaptureService and webcam frame encoding.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ReactionCaptureService,
  captureService,
  generateFallbackAvatar
} from '../src/screamer/capture.js';
import { eventBus } from '../src/utils/eventBus.js';

describe('ReactionCaptureService Unit Tests (US2.2 / T0)', () => {
  let service;

  beforeEach(() => {
    service = new ReactionCaptureService();
  });

  it('should initialise with null snapshot and clean in-memory state', () => {
    assert.strictEqual(service.getSnapshot(), null);
    assert.strictEqual(service.hasSnapshot(), false);
    assert.strictEqual(service.isFallback(), false);
  });

  it('should generate a valid Halloween thematic SVG data URL for fallback avatar', () => {
    const avatar = generateFallbackAvatar();
    assert.ok(typeof avatar === 'string');
    assert.ok(avatar.startsWith('data:image/svg+xml'));
  });

  it('should return fallback avatar when capture is requested without active video source', () => {
    const result = service.captureReactionSnapshot({ videoElement: null });

    assert.ok(result);
    assert.strictEqual(result.isFallback, true);
    assert.strictEqual(result.width, 400);
    assert.strictEqual(result.height, 400);
    assert.ok(typeof result.dataUrl === 'string');
    assert.ok(result.dataUrl.startsWith('data:image/svg+xml'));

    assert.strictEqual(service.hasSnapshot(), true);
    assert.strictEqual(service.isFallback(), true);
  });

  it('should return fallback avatar when video element has zero dimensions', () => {
    const mockZeroVideo = {
      videoWidth: 0,
      videoHeight: 0
    };

    const result = service.captureReactionSnapshot({ videoElement: mockZeroVideo });
    assert.strictEqual(result.isFallback, true);
    assert.strictEqual(service.isFallback(), true);
  });

  it('should capture video frame onto offscreen canvas and encode to WebP format', () => {
    let drawn = false;
    const mockVideo = {
      videoWidth: 640,
      videoHeight: 480
    };

    // Lightweight mock environment for canvas creation
    const originalDocument = globalThis.document;
    globalThis.document = {
      createElement: (tag) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: (type) => {
              if (type === '2d') {
                return {
                  drawImage: (src, sx, sy, sw, sh) => {
                    drawn = true;
                  }
                };
              }
              return null;
            },
            toDataURL: (format, quality) => `data:${format};base64,mockWebpData`
          };
        }
        return {};
      }
    };

    try {
      const result = service.captureReactionSnapshot({
        videoElement: mockVideo,
        format: 'image/webp',
        quality: 0.9
      });

      assert.strictEqual(drawn, true);
      assert.strictEqual(result.isFallback, false);
      assert.strictEqual(result.width, 640);
      assert.strictEqual(result.height, 480);
      assert.ok(result.dataUrl.startsWith('data:image/webp'));
      assert.strictEqual(service.getSnapshot(), result.dataUrl);
      assert.strictEqual(service.isFallback(), false);
    } finally {
      globalThis.document = originalDocument;
    }
  });

  it('should fallback to image/jpeg if WebP encoding is unsupported by canvas', () => {
    const mockVideo = {
      videoWidth: 1280,
      videoHeight: 720
    };

    const originalDocument = globalThis.document;
    globalThis.document = {
      createElement: (tag) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({ drawImage: () => {} }),
            toDataURL: (format) => {
              if (format === 'image/webp') {
                // Unsupported in older browsers returns PNG or empty
                return 'data:image/png;base64,unsupported';
              }
              return `data:${format};base64,mockJpegData`;
            }
          };
        }
        return {};
      }
    };

    try {
      const result = service.captureReactionSnapshot({ videoElement: mockVideo });
      assert.strictEqual(result.isFallback, false);
      assert.ok(result.dataUrl.startsWith('data:image/jpeg'));
    } finally {
      globalThis.document = originalDocument;
    }
  });

  it('should manage in-memory snapshot state with setSnapshot and clearSnapshot', () => {
    service.setSnapshot('data:image/webp;base64,sample', false);
    assert.strictEqual(service.hasSnapshot(), true);
    assert.strictEqual(service.getSnapshot(), 'data:image/webp;base64,sample');
    assert.strictEqual(service.isFallback(), false);

    service.clearSnapshot();
    assert.strictEqual(service.hasSnapshot(), false);
    assert.strictEqual(service.getSnapshot(), null);
    assert.strictEqual(service.isFallback(), false);
  });

  it('should synchronously capture photo and publish screamer:photo-captured upon game:trigger-screamer', () => {
    service.initialiseCaptureListener();

    let capturedPayload = null;
    const unsubscribe = eventBus.subscribe('screamer:photo-captured', (payload) => {
      capturedPayload = payload;
    });

    eventBus.publish('game:trigger-screamer', {
      reason: 'timer_expired',
      elapsedTime: 60
    });

    assert.ok(capturedPayload !== null);
    assert.strictEqual(typeof capturedPayload.dataUrl, 'string');
    assert.strictEqual(capturedPayload.triggerReason, 'timer_expired');
    assert.strictEqual(typeof capturedPayload.timestamp, 'number');
    assert.strictEqual(typeof capturedPayload.width, 'number');
    assert.strictEqual(typeof capturedPayload.height, 'number');

    unsubscribe();
    service.detachCaptureListener();
  });

  it('should detach capture trigger listener cleanly', () => {
    service.initialiseCaptureListener();
    assert.ok(service.unsubscribeTrigger !== null);

    service.detachCaptureListener();
    assert.strictEqual(service.unsubscribeTrigger, null);

    let eventCalled = false;
    const unsubscribe = eventBus.subscribe('screamer:photo-captured', () => {
      eventCalled = true;
    });

    eventBus.publish('game:trigger-screamer', { reason: 'test' });
    assert.strictEqual(eventCalled, false);

    unsubscribe();
  });

  it('should export a singleton captureService instance', () => {
    assert.ok(captureService instanceof ReactionCaptureService);
  });
});
