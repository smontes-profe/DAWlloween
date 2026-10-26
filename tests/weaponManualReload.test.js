/**
 * @file weaponManualReload.test.js
 * @description Unit tests for manual reload mechanics with Spacebar, suppression of automatic reload,
 * firing blockage upon magazine depletion, and cylinder replenishment.
 * Requirements: US6.3 / T5.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Weapon } from '../src/game/weapon.js';
import { GameEngine } from '../src/game/engine.js';
import { eventBus } from '../src/utils/eventBus.js';

/**
 * Creates a lightweight mock HTMLCanvasElement for engine tests.
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

describe('Manual Weapon Reload & Spacebar Trigger Unit Tests (US6.3 / T5)', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  describe('Weapon Auto-Reload Suppression & Firing Lockout', () => {
    it('should suppress automatic reload by default when cylinder reaches 0 rounds', () => {
      const weapon = new Weapon({ currentRounds: 1 });
      let reloadStarted = false;

      eventBus.subscribe('game:weapon-reload-start', () => {
        reloadStarted = true;
      });

      // Discharge the 1 remaining round
      const discharged = weapon.discharge();
      assert.strictEqual(discharged, true, 'Final round should discharge successfully');
      assert.strictEqual(weapon.currentRounds, 0, 'Cylinder should be empty');
      assert.strictEqual(weapon.isReloading, false, 'Auto-reload must be suppressed by default');
      assert.strictEqual(weapon.reloadTimer, 0, 'Reload timer should not be started');
      assert.strictEqual(reloadStarted, false, 'game:weapon-reload-start event should not fire automatically');
    });

    it('should strictly block firing attempts when currentRounds is 0', () => {
      const weapon = new Weapon({ currentRounds: 0 });

      assert.strictEqual(weapon.canShoot(), false, 'canShoot() must return false when magazine is empty');
      assert.strictEqual(weapon.discharge(), false, 'discharge() must return false when magazine is empty');
      assert.strictEqual(weapon.currentRounds, 0);
      assert.strictEqual(weapon.isReloading, false);
    });

    it('should allow manual reload when reload() is called explicitly', () => {
      const weapon = new Weapon({ currentRounds: 0 });
      let reloadStartPayload = null;

      eventBus.subscribe('game:weapon-reload-start', (data) => {
        reloadStartPayload = data;
      });

      const started = weapon.reload();
      assert.strictEqual(started, true, 'Manual reload() should initiate successfully');
      assert.strictEqual(weapon.isReloading, true);
      assert.strictEqual(weapon.reloadTimer, 1.80);
      assert.ok(reloadStartPayload, 'game:weapon-reload-start must be dispatched');
      assert.strictEqual(reloadStartPayload.currentRounds, 0);
      assert.strictEqual(reloadStartPayload.maxRounds, 6);
    });

    it('should replenish cylinder to 6 rounds upon completing reload duration', () => {
      const weapon = new Weapon({ currentRounds: 0 });
      weapon.reload();

      let reloadedEvent = null;
      eventBus.subscribe('game:weapon-reloaded', (data) => {
        reloadedEvent = data;
      });

      // Advance by half duration (0.9s)
      weapon.update(0.90);
      assert.strictEqual(weapon.isReloading, true);
      assert.strictEqual(weapon.currentRounds, 0);
      assert.strictEqual(reloadedEvent, null);

      // Advance past remaining duration (0.95s)
      weapon.update(0.95);
      assert.strictEqual(weapon.isReloading, false);
      assert.strictEqual(weapon.currentRounds, 6);
      assert.strictEqual(weapon.canShoot(), true);
      assert.ok(reloadedEvent, 'game:weapon-reloaded should be published');
      assert.strictEqual(reloadedEvent.currentRounds, 6);
    });
  });

  describe('GameEngine Spacebar Event Handling', () => {
    it('should trigger manual reload and prevent default scroll on Spacebar keydown', () => {
      const canvas = createMockCanvas();
      const weapon = new Weapon({ currentRounds: 0 });
      const engine = new GameEngine({ canvas, weapon });

      let defaultPrevented = false;
      let reloadEventPublished = false;

      eventBus.subscribe('game:weapon-reload-start', () => {
        reloadEventPublished = true;
      });

      // Simulate Spacebar keydown
      const spaceEvent = {
        code: 'Space',
        key: ' ',
        preventDefault: () => {
          defaultPrevented = true;
        }
      };

      engine.handleKeyDown(spaceEvent);

      assert.strictEqual(defaultPrevented, true, 'Spacebar press must call preventDefault to prevent browser scrolling');
      assert.strictEqual(weapon.isReloading, true, 'Weapon must enter reloading state on Spacebar');
      assert.strictEqual(reloadEventPublished, true, 'game:weapon-reload-start must be dispatched');

      engine.destroy();
    });

    it('should ignore Spacebar press if weapon cylinder is already at full capacity', () => {
      const canvas = createMockCanvas();
      const weapon = new Weapon({ currentRounds: 6, maxRounds: 6 });
      const engine = new GameEngine({ canvas, weapon });

      let reloadEventPublished = false;
      eventBus.subscribe('game:weapon-reload-start', () => {
        reloadEventPublished = true;
      });

      const spaceEvent = {
        code: 'Space',
        key: ' ',
        preventDefault: () => {}
      };

      engine.handleKeyDown(spaceEvent);

      assert.strictEqual(weapon.isReloading, false, 'Should not reload when cylinder is full');
      assert.strictEqual(reloadEventPublished, false, 'No reload event should fire');

      engine.destroy();
    });

    it('should ignore Spacebar press while reload is already in progress', () => {
      const canvas = createMockCanvas();
      const weapon = new Weapon({ currentRounds: 2 });
      weapon.reload(); // Already reloading
      const engine = new GameEngine({ canvas, weapon });

      const spaceEvent = {
        code: 'Space',
        key: ' ',
        preventDefault: () => {}
      };

      assert.strictEqual(weapon.reloadTimer, 1.80);

      // Advance by 0.5s
      weapon.update(0.5);
      assert.ok(weapon.reloadTimer < 1.80);
      const timerBefore = weapon.reloadTimer;

      // Press space again while reloading
      engine.handleKeyDown(spaceEvent);

      // Timer should not be reset
      assert.strictEqual(weapon.reloadTimer, timerBefore);

      engine.destroy();
    });
  });
});
