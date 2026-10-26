/**
 * @file playerHealth.test.js
 * @description Unit tests for discrete 5 Health Points (HP) management, enemy contact damage,
 * immediate enemy impact destruction, screen shake/flash feedback, and defeat jumpscare climax.
 * Requirements: US6.2 / T3.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, GAME_STATES } from '../src/game/engine.js';
import { Player, EntityFactory } from '../src/game/entities.js';
import { GAME_CONFIG } from '../src/config.js';
import { eventBus } from '../src/utils/eventBus.js';
import { AudioManager } from '../src/services/audio.js';

/**
 * Creates a mock HTMLCanvasElement with 2D rendering context.
 *
 * @returns {Object} Mock HTMLCanvasElement.
 */
function createMockCanvas() {
  const operations = [];
  const ctx = {
    operations,
    save: () => operations.push('save'),
    restore: () => operations.push('restore'),
    fillRect: (x, y, w, h) => operations.push(`fillRect(${x},${y},${w},${h})`),
    strokeRect: (x, y, w, h) => operations.push(`strokeRect(${x},${y},${w},${h})`),
    beginPath: () => operations.push('beginPath'),
    closePath: () => operations.push('closePath'),
    moveTo: () => operations.push('moveTo'),
    lineTo: () => operations.push('lineTo'),
    stroke: () => operations.push('stroke'),
    fill: () => operations.push('fill'),
    arc: () => operations.push('arc'),
    translate: (x, y) => operations.push(`translate(${x},${y})`),
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

describe('Player Health & Combat Feedback Unit Tests (US6.2 / T3)', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  describe('Player Entity Health Defaults & Discrete Damage', () => {
    it('should initialise Player with 5 discrete HP and maxHealth by default', () => {
      const player = new Player();
      assert.strictEqual(player.health, 5, 'Player should default to 5 HP');
      assert.strictEqual(player.maxHealth, 5, 'Player maxHealth should default to 5');
      assert.strictEqual(player.isAlive, true, 'Player should start alive');
    });

    it('should respect GAME_CONFIG values when creating default player', () => {
      assert.strictEqual(GAME_CONFIG.maxHp, 5);
      assert.strictEqual(GAME_CONFIG.initialHp, 5);
      assert.strictEqual(GAME_CONFIG.damagePerHit, 1);
    });

    it('should deduct discrete damage of 1 HP and update isAlive status', () => {
      const player = new Player();

      // First hit
      const defeated1 = player.takeDamage(1);
      assert.strictEqual(player.health, 4);
      assert.strictEqual(player.isAlive, true);
      assert.strictEqual(defeated1, false);

      // Subsequent hits down to 1
      player.takeDamage(1);
      player.takeDamage(1);
      player.takeDamage(1);
      assert.strictEqual(player.health, 1);
      assert.strictEqual(player.isAlive, true);

      // Lethal hit
      const defeatedFinal = player.takeDamage(1);
      assert.strictEqual(player.health, 0);
      assert.strictEqual(player.isAlive, false);
      assert.strictEqual(defeatedFinal, true);

      // Overkill damage should keep health at 0 and return false
      const overkill = player.takeDamage(1);
      assert.strictEqual(player.health, 0);
      assert.strictEqual(overkill, false);
    });
  });

  describe('GameEngine Enemy Contact Damage & Immediate Destruction', () => {
    it('should deduct 1 HP on enemy collision, destroy enemy immediately, and emit game:health-updated', () => {
      const canvas = createMockCanvas();
      const player = new Player({ x: 640, y: 360, health: 5, maxHealth: 5 });
      const engine = new GameEngine({ canvas, player, survivalDuration: 45 });
      engine.isSpawnerActive = false; // Disable background spawner so no unmanaged enemies spawn during frame
      engine.start();

      // Spawn an enemy directly on the player
      const enemy = EntityFactory.createEnemy('zombie', { x: 640, y: 360 });
      engine.enemies.push(enemy);
      assert.strictEqual(engine.enemies.length, 1);

      let publishedHit = null;
      let publishedHealth = null;

      eventBus.subscribe('game:player-hit', (data) => {
        publishedHit = data;
      });

      eventBus.subscribe('game:health-updated', (data) => {
        publishedHealth = data;
      });

      // Run one physics update frame to resolve collision
      engine.update(0.016);

      // 1. Verify health decremented by 1
      assert.strictEqual(player.health, 4, 'Player health should decrease from 5 to 4');
      assert.ok(publishedHit, 'game:player-hit event should be published');
      assert.strictEqual(publishedHit.damage, 1, 'Damage should be 1 HP');
      assert.strictEqual(publishedHit.playerDefeated, false, 'Player should not be defeated yet');

      // 2. Verify game:health-updated payload
      assert.ok(publishedHealth, 'game:health-updated event should be published');
      assert.strictEqual(publishedHealth.current, 4);
      assert.strictEqual(publishedHealth.max, 5);

      // 3. Verify colliding enemy is immediately destroyed and removed from active enemies array
      assert.strictEqual(enemy.isAlive, false, 'Colliding enemy must be marked dead immediately');
      assert.strictEqual(engine.enemies.length, 0, 'Dead enemy must be removed from engine enemies array');

      engine.destroy();
    });

    it('should trigger screen shake and damage flash timers upon collision', () => {
      const canvas = createMockCanvas();
      const player = new Player({ x: 640, y: 360 });
      const engine = new GameEngine({ canvas, player });
      engine.start();

      assert.strictEqual(engine.screenShakeTimer, 0);
      assert.strictEqual(engine.screenFlashTimer, 0);

      const enemy = EntityFactory.createEnemy('ghost', { x: 640, y: 360 });
      engine.enemies.push(enemy);

      engine.update(0.016);

      // Screen shake and crimson flash should be activated
      assert.ok(engine.screenShakeTimer > 0, 'Screen shake timer should be positive after hit');
      assert.ok(engine.screenFlashTimer > 0, 'Screen flash timer should be positive after hit');
      assert.ok(engine.screenShakeIntensity > 0, 'Screen shake intensity should be positive');

      engine.destroy();
    });

    it('should decay screen shake and flash timers over successive update frames', () => {
      const canvas = createMockCanvas();
      const player = new Player({ x: 640, y: 360 });
      const engine = new GameEngine({ canvas, player });

      // Trigger feedback manually
      engine.triggerDamageFeedback(0.2, 10, 0.15);
      assert.strictEqual(engine.screenShakeTimer, 0.2);
      assert.strictEqual(engine.screenFlashTimer, 0.15);

      // Advance time by 0.1s
      engine.state = GAME_STATES.RUNNING;
      engine.update(0.1);
      assert.ok(engine.screenShakeTimer <= 0.11 && engine.screenShakeTimer >= 0.09);
      assert.ok(engine.screenFlashTimer <= 0.06 && engine.screenFlashTimer >= 0.04);

      // Advance time beyond remaining duration
      engine.update(0.2);
      assert.strictEqual(engine.screenShakeTimer, 0);
      assert.strictEqual(engine.screenFlashTimer, 0);

      engine.destroy();
    });
  });

  describe('Defeat Climax Trigger when Health Reaches 0', () => {
    it('should trigger player_defeat climax immediately when 5th hit reduces HP to 0', () => {
      const canvas = createMockCanvas();
      const player = new Player({ x: 640, y: 360, health: 1 }); // 1 HP left
      const engine = new GameEngine({ canvas, player, survivalDuration: 40 });
      engine.start();

      const enemy = EntityFactory.createEnemy('zombie', { x: 640, y: 360 });
      engine.enemies.push(enemy);

      let climaxTriggered = null;
      let finalHealthEvent = null;

      eventBus.subscribe('game:trigger-screamer', (data) => {
        climaxTriggered = data;
      });

      eventBus.subscribe('game:health-updated', (data) => {
        finalHealthEvent = data;
      });

      engine.update(0.016);

      assert.strictEqual(player.health, 0, 'Player health should be 0');
      assert.strictEqual(player.isAlive, false, 'Player should be dead');
      assert.ok(finalHealthEvent, 'game:health-updated should be published');
      assert.strictEqual(finalHealthEvent.current, 0);

      assert.ok(climaxTriggered, 'game:trigger-screamer should be published on defeat');
      assert.strictEqual(climaxTriggered.reason, 'player_defeat');
      assert.strictEqual(engine.isClimaxTriggered, true);

      engine.destroy();
    });

    it('should broadcast initial health status on engine start', () => {
      const canvas = createMockCanvas();
      const player = new Player({ health: 5, maxHealth: 5 });
      const engine = new GameEngine({ canvas, player });

      let initialHealth = null;
      eventBus.subscribe('game:health-updated', (data) => {
        initialHealth = data;
      });

      engine.start();

      assert.ok(initialHealth, 'Initial health update should be dispatched on start()');
      assert.strictEqual(initialHealth.current, 5);
      assert.strictEqual(initialHealth.max, 5);

      engine.destroy();
    });
  });

  describe('Audio Service Impact Sound Trigger', () => {
    it('should invoke playPlayerDamage when game:player-hit event is dispatched', () => {
      const audio = new AudioManager();
      let damageSoundPlayed = false;

      audio.playPlayerDamage = () => {
        damageSoundPlayed = true;
      };

      audio.attachEventListeners();

      eventBus.publish('game:player-hit', { damage: 1 });
      assert.strictEqual(damageSoundPlayed, true, 'playPlayerDamage should be called on game:player-hit');

      audio.destroy();
    });
  });
});
