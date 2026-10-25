/**
 * @file engineDeathTrigger.test.js
 * @description Unit tests for player defeat jumpscare trigger and immediate loop halt in GameEngine.
 * Validates that when player health drops to zero, the engine immediately halts simulation,
 * ceases secondary timer dispatch, and fires 'game:trigger-screamer' with reason 'player_defeat'.
 * Requirements: US5.2 / T2.
 * Language Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, GAME_STATES } from '../src/game/engine.js';
import { Player, EntityFactory } from '../src/game/entities.js';
import { eventBus } from '../src/utils/eventBus.js';

/**
 * Creates a mock HTMLCanvasElement with 2D rendering context.
 *
 * @returns {Object} Mock HTMLCanvasElement.
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

describe('GameEngine Player Defeat Climax Trigger Unit Tests (US5.2 / T2)', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  it('should immediately trigger jumpscare with reason player_defeat when enemy collision depletes health to zero', () => {
    const canvas = createMockCanvas();
    const player = new Player({ x: 640, y: 360, health: 25 });
    const engine = new GameEngine({ canvas, player, survivalDuration: 30 });
    engine.start();

    // Spawn an enemy directly on top of the player with enough damage to defeat them
    const lethalEnemy = EntityFactory.createEnemy('ghost', { x: 640, y: 360 });
    lethalEnemy.damage = 50;
    engine.enemies.push(lethalEnemy);

    let publishedScreamer = null;
    let publishedPlayerHit = null;

    eventBus.subscribe('game:player-hit', (data) => {
      publishedPlayerHit = data;
    });

    eventBus.subscribe('game:trigger-screamer', (data) => {
      publishedScreamer = data;
    });

    // Run single update frame to resolve collision
    engine.update(0.016);

    assert.ok(publishedPlayerHit, 'game:player-hit should have been published');
    assert.strictEqual(publishedPlayerHit.playerDefeated, true, 'playerDefeated should be true in hit event');
    assert.strictEqual(player.health, 0, 'Player health should be depleted to 0');
    assert.strictEqual(player.isAlive, false, 'Player isAlive flag should be false');

    assert.ok(publishedScreamer, 'game:trigger-screamer must be published immediately upon player defeat');
    assert.strictEqual(publishedScreamer.reason, 'player_defeat', 'Payload reason must strictly be player_defeat');
    assert.strictEqual(engine.state, GAME_STATES.TRIGGERED, 'Engine state must immediately switch to TRIGGERED');
    assert.strictEqual(engine.isClimaxTriggered, true, 'isClimaxTriggered flag must be set to true');

    engine.destroy();
  });

  it('should immediately halt the loop and detach input listeners on player defeat without delay', () => {
    const canvas = createMockCanvas();
    const player = new Player({ x: 640, y: 360, health: 10 });
    const engine = new GameEngine({ canvas, player, survivalDuration: 45 });
    engine.start();

    // Simulate active movement key
    engine.activeKeys.add('KeyW');
    assert.strictEqual(engine.activeKeys.size, 1);

    // Call triggerClimax directly with player_defeat
    engine.triggerClimax('player_defeat');

    // Verify immediate halt without needing to wait for a timeout
    assert.strictEqual(engine.state, GAME_STATES.TRIGGERED, 'Engine state must be TRIGGERED');
    assert.strictEqual(engine.climaxHaltTimeoutId, null, 'climaxHaltTimeoutId should remain null for immediate defeat');
    assert.strictEqual(engine.activeKeys.size, 0, 'Active keys set should be cleared immediately');
    assert.strictEqual(player.isAlive, false, 'Player isAlive must be false');
    assert.strictEqual(player.health, 0, 'Player health must be set to 0');

    engine.destroy();
  });

  it('should halt secondary survival countdown progression and suppress timer ticks after defeat', () => {
    const canvas = createMockCanvas();
    const player = new Player({ x: 640, y: 360, health: 100 });
    const engine = new GameEngine({ canvas, player, survivalDuration: 10 });
    engine.start();

    // Defeat player before countdown finishes
    player.takeDamage(100);

    const receivedTicks = [];
    let timerExpiredFired = false;

    eventBus.subscribe('game:timer-tick', (data) => receivedTicks.push(data));
    eventBus.subscribe('game:timer-expired', () => { timerExpiredFired = true; });

    // Force engine state back to running to test update guard defensively
    engine.state = GAME_STATES.RUNNING;
    engine.update(5.0); // Large delta time that would otherwise expire a 10s timer

    assert.strictEqual(engine.isClimaxTriggered, true, 'Climax should be triggered');
    assert.strictEqual(timerExpiredFired, false, 'game:timer-expired must not be emitted after player defeat');
    assert.strictEqual(receivedTicks.length, 0, 'No timer tick events should be emitted after player defeat');

    engine.destroy();
  });

  it('should detect external player defeat during update and fire climax immediately', () => {
    const canvas = createMockCanvas();
    const player = new Player({ x: 640, y: 360, health: 50 });
    const engine = new GameEngine({ canvas, player, survivalDuration: 30 });
    engine.start();

    let publishedScreamer = null;
    eventBus.subscribe('game:trigger-screamer', (data) => {
      publishedScreamer = data;
    });

    // Deplete health externally
    player.health = 0;
    player.isAlive = false;

    // Run engine update
    engine.update(0.016);

    assert.ok(publishedScreamer, 'game:trigger-screamer should fire upon detecting defeated player in update');
    assert.strictEqual(publishedScreamer.reason, 'player_defeat');
    assert.strictEqual(engine.state, GAME_STATES.TRIGGERED);

    engine.destroy();
  });

  it('should reject duplicate climax triggers once already triggered', () => {
    const canvas = createMockCanvas();
    const player = new Player({ x: 640, y: 360, health: 100 });
    const engine = new GameEngine({ canvas, player, survivalDuration: 30 });
    engine.start();

    let triggerCount = 0;
    eventBus.subscribe('game:trigger-screamer', () => {
      triggerCount++;
    });

    const firstResult = engine.triggerClimax('player_defeat');
    const secondResult = engine.triggerClimax('timer_expired');

    assert.ok(firstResult, 'First trigger should return payload');
    assert.strictEqual(secondResult, null, 'Second trigger call must return null');
    assert.strictEqual(triggerCount, 1, 'Only one game:trigger-screamer event should be emitted');

    engine.destroy();
  });
});
