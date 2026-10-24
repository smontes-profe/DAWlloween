/**
 * @file audio.test.js
 * @description Unit tests for AudioManager, procedural sound synthesis, mute toggling,
 * ambient drone playback, and EventBus decoupled subscriptions.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AudioManager, audioService } from '../src/services/audio.js';
import { eventBus } from '../src/utils/eventBus.js';

/**
 * Creates a mock Web Audio API AudioContext for headless testing.
 *
 * @returns {Object} Mock AudioContext.
 */
function createMockAudioContext() {
  const operations = [];

  class MockAudioNode {
    constructor(type) {
      this.type = type;
      this.connectedTo = [];
    }

    connect(dest) {
      this.connectedTo.push(dest);
      operations.push(`${this.type}.connect(${dest.type || 'dest'})`);
    }

    disconnect() {
      operations.push(`${this.type}.disconnect`);
    }
  }

  class MockParam {
    constructor(name, val = 0) {
      this.name = name;
      this.value = val;
    }

    setValueAtTime(v, t) {
      this.value = v;
      operations.push(`${this.name}.setValueAtTime(${v},${t})`);
    }

    exponentialRampToValueAtTime(v, t) {
      this.value = v;
      operations.push(`${this.name}.exponentialRamp(${v},${t})`);
    }
  }

  class MockGainNode extends MockAudioNode {
    constructor() {
      super('gain');
      this.gain = new MockParam('gain', 1);
    }
  }

  class MockOscillatorNode extends MockAudioNode {
    constructor() {
      super('oscillator');
      this.type = 'sine';
      this.frequency = new MockParam('frequency', 440);
    }

    start(t) {
      operations.push(`oscillator.start(${t})`);
    }

    stop(t) {
      operations.push(`oscillator.stop(${t})`);
    }
  }

  class MockBiquadFilterNode extends MockAudioNode {
    constructor() {
      super('biquadFilter');
      this.type = 'lowpass';
      this.frequency = new MockParam('filterFrequency', 350);
      this.Q = new MockParam('filterQ', 1);
    }
  }

  class MockBufferSourceNode extends MockAudioNode {
    constructor() {
      super('bufferSource');
      this.buffer = null;
    }

    start(t) {
      operations.push(`bufferSource.start(${t})`);
    }

    stop(t) {
      operations.push(`bufferSource.stop(${t})`);
    }
  }

  return {
    operations,
    currentTime: 10.0,
    sampleRate: 44100,
    state: 'running',
    destination: { type: 'destination' },
    createGain: () => new MockGainNode(),
    createOscillator: () => new MockOscillatorNode(),
    createBiquadFilter: () => new MockBiquadFilterNode(),
    createBufferSource: () => new MockBufferSourceNode(),
    createBuffer: (channels, length, rate) => ({
      numberOfChannels: channels,
      length,
      sampleRate: rate,
      getChannelData: () => new Float32Array(length)
    }),
    resume: async () => {},
    close: async () => { operations.push('context.close'); }
  };
}

describe('AudioManager Unit Tests (US1.5 / T13)', () => {
  let manager;
  let originalWindow;

  beforeEach(() => {
    manager = new AudioManager();
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
    if (originalWindow !== undefined) {
      global.window = originalWindow;
    }
  });

  it('should detect environment support gracefully', () => {
    // When window is undefined or lacks AudioContext
    originalWindow = global.window;
    delete global.window;
    assert.strictEqual(manager.isSupported(), false);

    // When window has AudioContext mock
    global.window = { AudioContext: class {} };
    assert.strictEqual(manager.isSupported(), true);
  });

  it('should initialise AudioContext and routing nodes successfully', () => {
    originalWindow = global.window;
    const mockCtx = createMockAudioContext();
    global.window = {
      AudioContext: function () {
        return mockCtx;
      }
    };

    const initialised = manager.initialise();
    assert.strictEqual(initialised, true);
    assert.strictEqual(manager.isInitialised, true);
    assert.ok(manager.masterGain !== null);
    assert.ok(manager.ambientGain !== null);
  });

  it('should manage master mute toggle and update master gain node', () => {
    originalWindow = global.window;
    const mockCtx = createMockAudioContext();
    global.window = { AudioContext: function () { return mockCtx; } };

    manager.initialise();
    assert.strictEqual(manager.isMuted(), false);

    // Mute
    manager.setMuted(true);
    assert.strictEqual(manager.isMuted(), true);
    assert.strictEqual(manager.masterGain.gain.value, 0);

    // Unmute
    manager.setMuted(false);
    assert.strictEqual(manager.isMuted(), false);
    assert.strictEqual(manager.masterGain.gain.value, manager.volume);

    // Toggle mute
    manager.toggleMute();
    assert.strictEqual(manager.isMuted(), true);
  });

  it('should synthesise shoot, reload, and hit sound effects without throwing', () => {
    originalWindow = global.window;
    const mockCtx = createMockAudioContext();
    global.window = { AudioContext: function () { return mockCtx; } };

    manager.initialise();

    assert.doesNotThrow(() => {
      manager.playShoot();
      manager.playReloadStart();
      manager.playReloadComplete();
      manager.playHit();
    });

    assert.ok(mockCtx.operations.some((op) => op.includes('gain.setValueAtTime')));
    assert.ok(mockCtx.operations.some((op) => op.includes('oscillator.start')));
  });

  it('should start and stop ambient gothic drone loop', () => {
    originalWindow = global.window;
    const mockCtx = createMockAudioContext();
    global.window = { AudioContext: function () { return mockCtx; } };

    manager.initialise();
    assert.strictEqual(manager.ambientOscillators.length, 0);

    // Start ambient
    manager.startAmbient();
    assert.strictEqual(manager.ambientOscillators.length, 3); // 2 drone oscillators + 1 LFO

    // Stop ambient
    manager.stopAmbient();
    assert.strictEqual(manager.ambientOscillators.length, 0);
  });

  it('should trigger sound synthesis automatically via EventBus events', () => {
    originalWindow = global.window;
    const mockCtx = createMockAudioContext();
    global.window = { AudioContext: function () { return mockCtx; } };

    manager.initialise();

    let shootCalled = false;
    let reloadStartCalled = false;
    let reloadedCalled = false;
    let hitCalled = false;

    manager.playShoot = () => { shootCalled = true; };
    manager.playReloadStart = () => { reloadStartCalled = true; };
    manager.playReloadComplete = () => { reloadedCalled = true; };
    manager.playHit = () => { hitCalled = true; };

    // Emit events through EventBus
    eventBus.publish('game:player-shoot', {});
    assert.strictEqual(shootCalled, true);

    eventBus.publish('game:weapon-reload-start', {});
    assert.strictEqual(reloadStartCalled, true);

    eventBus.publish('game:weapon-reloaded', {});
    assert.strictEqual(reloadedCalled, true);

    eventBus.publish('game:projectile-hit', {});
    assert.strictEqual(hitCalled, true);

    eventBus.publish('audio:toggle-mute', { isMuted: true });
    assert.strictEqual(manager.isMuted(), true);
  });

  it('should synthesise high-intensity screech sound on playScreamer()', () => {
    originalWindow = global.window;
    const mockCtx = createMockAudioContext();
    global.window = { AudioContext: function () { return mockCtx; } };

    manager.initialise();

    assert.doesNotThrow(() => {
      manager.playScreamer();
    });

    // Verify oscillator and bufferSource operations
    assert.ok(mockCtx.operations.some((op) => op.includes('oscillator.start')));
    assert.ok(mockCtx.operations.some((op) => op.includes('bufferSource.start')));
    assert.ok(mockCtx.operations.some((op) => op.includes('gain.exponentialRamp')));
  });

  it('should not play screamer sound if audio manager is muted', () => {
    originalWindow = global.window;
    const mockCtx = createMockAudioContext();
    global.window = { AudioContext: function () { return mockCtx; } };

    manager.initialise();
    manager.setMuted(true);

    const initialOpCount = mockCtx.operations.length;
    manager.playScreamer();

    // No new audio nodes or starts created
    assert.strictEqual(mockCtx.operations.length, initialOpCount);
  });

  it('should trigger playScreamer automatically via screamer:play-sound and game:trigger-screamer events', () => {
    originalWindow = global.window;
    const mockCtx = createMockAudioContext();
    global.window = { AudioContext: function () { return mockCtx; } };

    manager.initialise();

    let screamerCalls = 0;
    manager.playScreamer = () => { screamerCalls++; };

    eventBus.publish('screamer:play-sound', {});
    assert.strictEqual(screamerCalls, 1);

    eventBus.publish('game:trigger-screamer', {});
    assert.strictEqual(screamerCalls, 2);
  });

  it('should export singleton instance audioService', () => {
    assert.ok(audioService instanceof AudioManager);
  });
});
