/**
 * @file screamerSync.test.js
 * @description Unit tests validating continuous gameplay simulation during jumpscare exposure,
 * synchronized camera reaction recording, input shielding, and clean halt on transition completion (US5.2 / T11).
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, GAME_STATES } from '../src/game/engine.js';
import { Player, EntityFactory } from '../src/game/entities.js';
import { eventBus } from '../src/utils/eventBus.js';

/**
 * Creates a mock canvas for GameEngine testing.
 */
function createMockCanvas() {
  const ctx = {
    save: () => {},
    restore: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    translate: () => {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1
  };

  return {
    width: 1280,
    height: 720,
    getContext: () => ctx,
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 })
  };
}

describe('Jumpscare and Gameplay Synchronization Unit Tests (US5.2 / T11)', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  afterEach(() => {
    eventBus.clear();
  });

  it('should maintain simulation loop and background rendering during jumpscare shock upon player defeat', () => {
    const canvas = createMockCanvas();
    const player = new Player({ x: 640, y: 360, health: 10 });
    const engine = new GameEngine({ canvas, player, survivalDuration: 30 });
    engine.start();

    // Defeat player
    player.takeDamage(50);
    engine.update(0.016);

    // Engine must remain in RUNNING simulation mode so background arena doesn't freeze
    assert.strictEqual(engine.isClimaxTriggered, true, 'Climax must be marked as triggered');
    assert.strictEqual(engine.state, GAME_STATES.RUNNING, 'Engine state must remain RUNNING during shock');
    assert.strictEqual(player.isAlive, false, 'Player must be dead');

    // Add an enemy to verify enemies continue animating
    const enemy = EntityFactory.createEnemy('zombie', { x: 500, y: 300 });
    engine.enemies.push(enemy);

    const initialEnemyX = enemy.x;
    engine.update(0.1); // Update frame during active climax

    // Enemy should have moved towards player position
    assert.notStrictEqual(enemy.x, initialEnemyX, 'Enemies must continue moving during the shock');

    // Publish screamer:transition-complete to conclude the scare
    eventBus.publish('screamer:transition-complete', { timestamp: Date.now() });

    assert.strictEqual(engine.state, GAME_STATES.TRIGGERED, 'Engine state must transition to TRIGGERED upon screamer completion');

    engine.destroy();
  });

  it('should immediately detach player input listeners upon climax trigger so shooting/movement is disabled', () => {
    const canvas = createMockCanvas();
    const player = new Player({ x: 640, y: 360, health: 100 });
    const engine = new GameEngine({ canvas, player, survivalDuration: 30 });
    engine.start();

    engine.activeKeys.add('KeyW');
    engine.activeKeys.add('KeyD');
    assert.strictEqual(engine.activeKeys.size, 2);

    engine.triggerClimax('timer_expired', 3500);

    // Input listeners must be detached and activeKeys cleared immediately
    assert.strictEqual(engine.activeKeys.size, 0, 'Active keys must be cleared upon climax trigger');

    // Simulate further key presses
    engine.handleKeyDown({ code: 'KeyW' });
    assert.strictEqual(engine.activeKeys.size, 0, 'New key events must be ignored once climax is triggered');

    engine.destroy();
  });

  it('should halt cleanly when screamer:transition-complete event is dispatched via EventBus', () => {
    const canvas = createMockCanvas();
    const player = new Player({ x: 640, y: 360, health: 100 });
    const engine = new GameEngine({ canvas, player, survivalDuration: 30 });
    engine.start();

    engine.triggerClimax('timer_expired', 3500);
    assert.strictEqual(engine.state, GAME_STATES.RUNNING);

    // ScreamerView finishes exposure and emits transition complete
    eventBus.publish('screamer:transition-complete', { timestamp: Date.now() });

    assert.strictEqual(engine.state, GAME_STATES.TRIGGERED, 'Engine must halt upon screamer:transition-complete');

    engine.destroy();
  });

  it('should automatically engage safety fallback timeout if screamer:transition-complete is never emitted', () => {
    const originalSetTimeout = global.setTimeout;
    const scheduledTimeouts = [];

    global.setTimeout = (fn, delay) => {
      const id = scheduledTimeouts.length + 1;
      scheduledTimeouts.push({ id, fn, delay });
      return id;
    };

    try {
      const canvas = createMockCanvas();
      const player = new Player({ x: 640, y: 360, health: 100 });
      const engine = new GameEngine({ canvas, player, survivalDuration: 30 });
      engine.start();

      engine.triggerClimax('timer_expired', 3500);

      // Verify safety fallback was scheduled with a generous delay (> 7000ms)
      assert.ok(engine.climaxHaltTimeoutId !== null, 'Safety fallback timeout must be scheduled');
      const fallbackEntry = scheduledTimeouts.find((t) => t.id === engine.climaxHaltTimeoutId);
      assert.ok(fallbackEntry);
      assert.ok(fallbackEntry.delay >= 7500, 'Safety timeout must be at least 7500ms');

      // Trigger fallback timeout manually
      fallbackEntry.fn();

      assert.strictEqual(engine.state, GAME_STATES.TRIGGERED, 'Engine must halt upon safety fallback expiry');

      engine.destroy();
    } finally {
      global.setTimeout = originalSetTimeout;
    }
  });
});
