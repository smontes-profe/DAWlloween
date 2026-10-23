/**
 * @file camera.test.js
 * @description Unit tests for CameraService.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { CameraService } from '../src/screamer/camera.js';
import { eventBus } from '../src/utils/eventBus.js';

describe('CameraService Unit Tests', () => {
  const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let originalDocument;

  function mockNavigator(navObj) {
    Object.defineProperty(globalThis, 'navigator', {
      value: navObj,
      configurable: true,
      writable: true
    });
  }

  function restoreNavigator() {
    if (originalNavigatorDesc) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
    } else {
      delete globalThis.navigator;
    }
  }

  beforeEach(() => {
    originalDocument = globalThis.document;
    eventBus.clear();
  });

  afterEach(() => {
    restoreNavigator();
    globalThis.document = originalDocument;
    eventBus.clear();
  });

  it('should detect environment support via isSupported', () => {
    const service = new CameraService();

    // Unsupported when navigator.mediaDevices is missing
    mockNavigator({});
    assert.equal(service.isSupported(), false);

    // Supported when getUserMedia function exists
    mockNavigator({
      mediaDevices: {
        getUserMedia: async () => {}
      }
    });
    assert.equal(service.isSupported(), true);
  });

  it('should gracefully handle unsupported environment in requestPermission', async () => {
    mockNavigator({});
    const service = new CameraService();

    const events = [];
    eventBus.subscribe('camera:unsupported', (e) => events.push(e));

    const result = await service.requestPermission();
    assert.equal(result.success, false);
    assert.equal(result.error, 'NOT_SUPPORTED');
    assert.equal(events.length, 1);
  });

  it('should acquire stream and publish camera:stream-ready on permission grant', async () => {
    let trackStopped = false;
    const mockTrack = {
      stop: () => {
        trackStopped = true;
      }
    };
    const mockStream = {
      getTracks: () => [mockTrack]
    };

    mockNavigator({
      mediaDevices: {
        getUserMedia: async () => mockStream
      }
    });

    const service = new CameraService();
    const readyEvents = [];
    eventBus.subscribe('camera:stream-ready', (e) => readyEvents.push(e));

    const result = await service.requestPermission();

    assert.equal(result.success, true);
    assert.equal(result.stream, mockStream);
    assert.equal(service.isStreamActive(), true);
    assert.equal(service.hasUserPermission(), true);
    assert.equal(readyEvents.length, 1);
    assert.equal(readyEvents[0].stream, mockStream);

    // Stop stream verification
    const stopEvents = [];
    eventBus.subscribe('camera:stream-stopped', () => stopEvents.push(true));

    service.stopStream();
    assert.equal(trackStopped, true);
    assert.equal(service.isStreamActive(), false);
    assert.equal(stopEvents.length, 1);
  });

  it('should publish camera:permission-denied when user refuses webcam access', async () => {
    const permissionError = new Error('Permission denied by user');
    permissionError.name = 'NotAllowedError';

    mockNavigator({
      mediaDevices: {
        getUserMedia: async () => {
          throw permissionError;
        }
      }
    });

    const service = new CameraService();
    const deniedEvents = [];
    eventBus.subscribe('camera:permission-denied', (e) => deniedEvents.push(e));

    const result = await service.requestPermission();

    assert.equal(result.success, false);
    assert.equal(result.error, permissionError);
    assert.equal(service.isStreamActive(), false);
    assert.equal(service.hasUserPermission(), false);
    assert.equal(deniedEvents.length, 1);
  });

  it('should publish camera:error on hardware or general getUserMedia failure', async () => {
    const notFoundError = new Error('Requested device not found');
    notFoundError.name = 'NotFoundError';

    mockNavigator({
      mediaDevices: {
        getUserMedia: async () => {
          throw notFoundError;
        }
      }
    });

    const service = new CameraService();
    const errorEvents = [];
    eventBus.subscribe('camera:error', (e) => errorEvents.push(e));

    const result = await service.requestPermission();

    assert.equal(result.success, false);
    assert.equal(result.error, notFoundError);
    assert.equal(errorEvents.length, 1);
  });

  it('should attach active stream to HTMLVideoElement', async () => {
    const mockStream = { getTracks: () => [] };
    mockNavigator({
      mediaDevices: {
        getUserMedia: async () => mockStream
      }
    });

    const service = new CameraService();
    await service.requestPermission();

    let playInvoked = false;
    const mockVideo = {
      srcObject: null,
      setAttribute: () => {},
      muted: false,
      play: async () => {
        playInvoked = true;
      }
    };

    const attached = await service.attachVideoElement(mockVideo);
    assert.equal(attached, true);
    assert.equal(mockVideo.srcObject, mockStream);
    assert.equal(mockVideo.muted, true);
    assert.equal(playInvoked, true);
  });

  it('should capture a video frame as WebP data URL', async () => {
    const mockStream = { getTracks: () => [] };
    mockNavigator({
      mediaDevices: {
        getUserMedia: async () => mockStream
      }
    });

    const service = new CameraService();
    await service.requestPermission();

    const mockVideo = {
      srcObject: null,
      videoWidth: 640,
      videoHeight: 480,
      setAttribute: () => {},
      play: async () => {}
    };

    await service.attachVideoElement(mockVideo);

    let drawnImage = null;
    class MockCanvas {
      constructor() {
        this.width = 0;
        this.height = 0;
      }
      getContext(type) {
        if (type === '2d') {
          return {
            drawImage: (src, x, y, w, h) => {
              drawnImage = { src, x, y, w, h };
            }
          };
        }
        return null;
      }
      toDataURL(format) {
        return `data:${format};base64,mockWebpFrameData`;
      }
    }

    globalThis.document = {
      createElement: (tag) => (tag === 'canvas' ? new MockCanvas() : {})
    };

    const captureEvents = [];
    eventBus.subscribe('camera:frame-captured', (e) => captureEvents.push(e));

    const frame = service.captureFrame('image/webp', 0.9);
    assert.equal(frame, 'data:image/webp;base64,mockWebpFrameData');
    assert.ok(drawnImage);
    assert.equal(drawnImage.w, 640);
    assert.equal(drawnImage.h, 480);
    assert.equal(captureEvents.length, 1);
  });
});
