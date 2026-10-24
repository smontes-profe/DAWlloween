/**
 * @file engine.test.js
 * @description Unit tests for 60 FPS HTML5 Canvas Game Engine, fixed/delta-time loop,
 * strict WASD input manager, continuous mouse aiming, and entity lifecycles.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, GAME_STATES } from '../src/game/engine.js';
import { Player } from '../src/game/entities.js';

/**
 * Creates a mock 2D canvas context for engine render validation.
 *
 * @returns {Object} Mock CanvasRenderingContext2D.
 */
function createMockContext() {
  const calls = [];
  return {
    calls,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    fillRect: (x, y, w, h) => calls.push(`fillRect(${x},${y},${w},${h})`),
    strokeRect: (x, y, w, h) => calls.push(`strokeRect(${x},${y},${w},${h})`),
    beginPath: () => calls.push('beginPath'),
    closePath: () => calls.push('closePath'),
    moveTo: (x, y) => calls.push(`moveTo(${x},${y})`),
    lineTo: (x, y) => calls.push(`lineTo(${x},${y})`),
    stroke: () => calls.push('stroke'),
    fill: () => calls.push('fill'),
    arc: () => calls.push('arc'),
    rect: () => calls.push('rect'),
    translate: () => calls.push('translate'),
    rotate: () => calls.push('rotate'),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    createRadialGradient: () => ({ addColorStop: () => {} })
  };
}

/**
 * Creates a mock HTMLCanvasElement.
 *
 * @param {Object} [options={}]
 * @returns {Object} Mock HTMLCanvasElement.
 */
function createMockCanvas({ width = 1280, height = 720, clientWidth = 640, clientHeight = 360 } = {}) {
  const ctx = createMockContext();
  const listeners = new Map();

  return {
    width,
    height,
    getContext: (type) => (type === '2d' ? ctx : null),
    addEventListener: (evt, fn) => {
      if (!listeners.has(evt)) listeners.set(evt, []);
      listeners.get(evt).push(fn);
    },
    removeEventListener: (evt, fn) => {
      if (listeners.has(evt)) {
        const arr = listeners.get(evt);
        const idx = arr.indexOf(fn);
        if (idx !== -1) arr.splice(idx, 1);
      }
    },
    getBoundingClientRect: () => ({
      left: 100,
      top: 50,
      width: clientWidth,
      height: clientHeight
    }),
    _mockContext: ctx,
    _listeners: listeners
  };
}

describe('GameEngine Core & State Transitions Unit Tests', () => {
  it('should initialise in IDLE state with default logical arena dimensions (1280x720)', () => {
    const engine = new GameEngine();
    assert.strictEqual(engine.state, GAME_STATES.IDLE);
    assert.strictEqual(engine.width, 1280);
    assert.strictEqual(engine.height, 720);
    assert.ok(engine.player instanceof Player);
    // Player initialised in the center of the arena
    assert.strictEqual(engine.player.x, 640);
    assert.strictEqual(engine.player.y, 360);
  });

  it('should transition between RUNNING, PAUSED, and STOPPED states', () => {
    const mockCanvas = createMockCanvas();
    const engine = new GameEngine({ canvas: mockCanvas });

    // Start engine
    engine.start();
    assert.strictEqual(engine.state, GAME_STATES.RUNNING);

    // Pause engine
    engine.pause();
    assert.strictEqual(engine.state, GAME_STATES.PAUSED);

    // Resume engine
    engine.resume();
    assert.strictEqual(engine.state, GAME_STATES.RUNNING);

    // Stop engine
    engine.stop();
    assert.strictEqual(engine.state, GAME_STATES.STOPPED);
  });

  it('should cleanly release references and detach handlers upon destroy()', () => {
    const mockCanvas = createMockCanvas();
    const engine = new GameEngine({ canvas: mockCanvas });

    engine.start();
    assert.strictEqual(engine.state, GAME_STATES.RUNNING);

    engine.destroy();
    assert.strictEqual(engine.state, GAME_STATES.STOPPED);
    assert.strictEqual(engine.canvas, null);
    assert.strictEqual(engine.ctx, null);
    assert.strictEqual(engine.activeKeys.size, 0);
  });
});

describe('GameEngine Input Manager (WASD & Continuous Mouse Aiming)', () => {
  let engine;

  beforeEach(() => {
    engine = new GameEngine({ width: 1000, height: 800 });
  });

  it('should register WASD movement keys and ignore arrow keys', () => {
    // Press WASD keys
    engine.handleKeyDown({ code: 'KeyW' });
    engine.handleKeyDown({ code: 'KeyA' });
    engine.handleKeyDown({ code: 'KeyS' });
    engine.handleKeyDown({ code: 'KeyD' });

    assert.strictEqual(engine.activeKeys.size, 4);
    assert.ok(engine.activeKeys.has('KeyW'));
    assert.ok(engine.activeKeys.has('KeyA'));
    assert.ok(engine.activeKeys.has('KeyS'));
    assert.ok(engine.activeKeys.has('KeyD'));

    // Release W and A
    engine.handleKeyUp({ code: 'KeyW' });
    engine.handleKeyUp({ code: 'KeyA' });
    assert.strictEqual(engine.activeKeys.size, 2);
    assert.ok(engine.activeKeys.has('KeyS'));
    assert.ok(engine.activeKeys.has('KeyD'));

    // Attempt arrow keys - must be strictly ignored
    engine.handleKeyDown({ code: 'ArrowUp' });
    engine.handleKeyDown({ code: 'ArrowDown' });
    engine.handleKeyDown({ code: 'ArrowLeft' });
    engine.handleKeyDown({ code: 'ArrowRight' });

    assert.strictEqual(engine.activeKeys.has('ArrowUp'), false);
    assert.strictEqual(engine.activeKeys.has('ArrowDown'), false);
    assert.strictEqual(engine.activeKeys.has('ArrowLeft'), false);
    assert.strictEqual(engine.activeKeys.has('ArrowRight'), false);
    assert.strictEqual(engine.activeKeys.size, 2);
  });

  it('should compute exact directional input vectors from WASD keys', () => {
    // Empty keys -> (0, 0)
    assert.deepStrictEqual(engine.computeInputDirection(), { moveX: 0, moveY: 0 });

    // North (W)
    engine.activeKeys.add('KeyW');
    assert.deepStrictEqual(engine.computeInputDirection(), { moveX: 0, moveY: -1 });

    // North-East (W + D)
    engine.activeKeys.add('KeyD');
    assert.deepStrictEqual(engine.computeInputDirection(), { moveX: 1, moveY: -1 });

    // East (D)
    engine.activeKeys.delete('KeyW');
    assert.deepStrictEqual(engine.computeInputDirection(), { moveX: 1, moveY: 0 });

    // South-West (S + A)
    engine.activeKeys.clear();
    engine.activeKeys.add('KeyS');
    engine.activeKeys.add('KeyA');
    assert.deepStrictEqual(engine.computeInputDirection(), { moveX: -1, moveY: 1 });
  });

  it('should project mouse coordinates into arena space and continuously orient player', () => {
    const mockCanvas = createMockCanvas({
      width: 1280,
      height: 720,
      clientWidth: 640,  // Scale factor = 1280 / 640 = 2.0
      clientHeight: 360  // Scale factor = 720 / 360 = 2.0
    });

    const arenaEngine = new GameEngine({ canvas: mockCanvas });
    // Player is at (640, 360)
    assert.strictEqual(arenaEngine.player.x, 640);
    assert.strictEqual(arenaEngine.player.y, 360);

    // Mouse positioned at client coords (100 + 320, 50 + 180) -> Canvas center (640, 360)
    arenaEngine.handleMouseMove({ clientX: 420, clientY: 230 });
    assert.strictEqual(arenaEngine.cursorX, 640);
    assert.strictEqual(arenaEngine.cursorY, 360);

    // Move mouse directly to the right of center: clientX = 420 + 50 -> arena X = 640 + 100 = 740
    arenaEngine.handleMouseMove({ clientX: 470, clientY: 230 });
    assert.strictEqual(arenaEngine.cursorX, 740);
    assert.strictEqual(arenaEngine.cursorY, 360);
    // Angle pointing directly East / Right should be 0 radians
    assert.strictEqual(arenaEngine.player.angle, 0);

    // Move mouse directly downward from center: arena Y = 360 + 100 = 460
    arenaEngine.handleMouseMove({ clientX: 420, clientY: 280 });
    assert.strictEqual(arenaEngine.cursorX, 640);
    assert.strictEqual(arenaEngine.cursorY, 460);
    // Angle pointing directly South / Down should be PI / 2 radians
    assert.strictEqual(arenaEngine.player.angle, Math.PI / 2);
  });
});

describe('GameEngine Simulation Loop & Boundary Clamping', () => {
  it('should update player position and clamp within arena boundary during update()', () => {
    const engine = new GameEngine({ width: 500, height: 500 });
    engine.state = GAME_STATES.RUNNING;
    engine.player.x = 250;
    engine.player.y = 250;
    engine.player.speed = 100;

    // Simulate pressing 'KeyD' (moving right at 100 px/sec for 0.5s = +50px)
    engine.activeKeys.add('KeyD');
    engine.update(0.5);

    assert.strictEqual(engine.player.x, 300);
    assert.strictEqual(engine.player.y, 250);

    // Move continuously past right arena boundary
    engine.player.x = 490;
    engine.update(0.5);
    // Should be clamped to width - player.radius (500 - 18 = 482)
    assert.strictEqual(engine.player.x, 482);
  });

  it('should not perform simulation updates if engine is not in RUNNING state', () => {
    const engine = new GameEngine({ width: 500, height: 500 });
    engine.state = GAME_STATES.PAUSED;
    engine.player.x = 200;
    engine.activeKeys.add('KeyD');

    engine.update(0.5);
    assert.strictEqual(engine.player.x, 200);
  });

  it('should execute render pass drawing background and player onto canvas context', () => {
    const mockCanvas = createMockCanvas();
    const engine = new GameEngine({ canvas: mockCanvas });

    assert.doesNotThrow(() => {
      engine.render();
    });

    const calls = mockCanvas._mockContext.calls;
    assert.ok(calls.includes('fillRect(0,0,1280,720)'));
    assert.ok(calls.includes('strokeRect(2,2,1276,716)'));
  });

  it('should defensively cap deltaTime against large frame spikes', () => {
    const engine = new GameEngine();
    engine.state = GAME_STATES.RUNNING;

    let receivedDelta = 0;
    engine.update = (dt) => {
      receivedDelta = dt;
    };

    // First frame initializes lastTimestamp
    engine.gameLoop(1000);
    assert.strictEqual(engine.lastTimestamp, 1000);

    // Second frame with enormous 5.0 second latency spike
    engine.gameLoop(6000);
    // Must be capped at 0.1s maximum
    assert.strictEqual(receivedDelta, 0.1);

    engine.stop();
  });
});
