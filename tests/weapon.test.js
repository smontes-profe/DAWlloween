/**
 * @file weapon.test.js
 * @description Unit tests for weapon mechanics, 6-round magazine, fire rate throttle,
 * automatic & manual reload cooldown transitions, and EventBus publications.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Weapon } from '../src/game/weapon.js';
import { eventBus } from '../src/utils/eventBus.js';

describe('Weapon Mechanics Unit Tests (US1.4 / T12)', () => {
  it('should initialise with 6-round capacity, default rate throttle, and ready state', () => {
    const weapon = new Weapon();
    assert.strictEqual(weapon.maxRounds, 6);
    assert.strictEqual(weapon.currentRounds, 6);
    assert.strictEqual(weapon.fireThrottle, 0.20);
    assert.strictEqual(weapon.reloadDuration, 1.80);
    assert.strictEqual(weapon.isReloading, false);
    assert.strictEqual(weapon.canShoot(), true);
  });

  it('should decrement ammunition and engage throttle timer upon discharge', () => {
    const weapon = new Weapon();
    let ammoEvent = null;

    const unsubscribe = eventBus.subscribe('game:ammo-updated', (payload) => {
      ammoEvent = payload;
    });

    const discharged = weapon.discharge();
    assert.strictEqual(discharged, true);
    assert.strictEqual(weapon.currentRounds, 5);
    assert.strictEqual(weapon.throttleTimer, 0.20);
    assert.ok(ammoEvent !== null);
    assert.strictEqual(ammoEvent.currentRounds, 5);
    assert.strictEqual(ammoEvent.maxRounds, 6);
    assert.strictEqual(ammoEvent.isReloading, false);

    unsubscribe();
  });

  it('should throttle rapid consecutive shots within throttle duration', () => {
    const weapon = new Weapon();
    weapon.discharge();

    // Immediate subsequent shot must be blocked by rate throttle
    assert.strictEqual(weapon.canShoot(), false);
    assert.strictEqual(weapon.discharge(), false);
    assert.strictEqual(weapon.currentRounds, 5);

    // Advance time by 0.1s (throttle still active: 0.1s remaining)
    weapon.update(0.10);
    assert.strictEqual(weapon.canShoot(), false);

    // Advance time by another 0.11s (throttle expires)
    weapon.update(0.11);
    assert.strictEqual(weapon.canShoot(), true);
    assert.strictEqual(weapon.discharge(), true);
    assert.strictEqual(weapon.currentRounds, 4);
  });

  it('should automatically trigger reload cooldown when 6th round is spent if autoReload is configured', () => {
    const weapon = new Weapon({ currentRounds: 1, autoReload: true });
    let reloadStartEvent = null;

    const unsubscribe = eventBus.subscribe('game:weapon-reload-start', (payload) => {
      reloadStartEvent = payload;
    });

    const discharged = weapon.discharge();
    assert.strictEqual(discharged, true);
    assert.strictEqual(weapon.currentRounds, 0);
    assert.strictEqual(weapon.isReloading, true);
    assert.strictEqual(weapon.reloadTimer, 1.80);
    assert.ok(reloadStartEvent !== null);
    assert.strictEqual(reloadStartEvent.duration, 1.80);

    unsubscribe();
  });

  it('should support manual reload when magazine is partially depleted', () => {
    const weapon = new Weapon({ currentRounds: 4 });
    const started = weapon.startReload();

    assert.strictEqual(started, true);
    assert.strictEqual(weapon.isReloading, true);
    assert.strictEqual(weapon.reloadTimer, 1.80);

    // Attempting to reload while already reloading returns false
    assert.strictEqual(weapon.startReload(), false);
  });

  it('should not allow manual reload if cylinder is already at full capacity', () => {
    const weapon = new Weapon({ currentRounds: 6 });
    assert.strictEqual(weapon.startReload(), false);
    assert.strictEqual(weapon.isReloading, false);
  });

  it('should strictly block firing while reload is in progress', () => {
    const weapon = new Weapon({ currentRounds: 2 });
    weapon.startReload();

    assert.strictEqual(weapon.isReloading, true);
    assert.strictEqual(weapon.canShoot(), false);
    assert.strictEqual(weapon.discharge(), false);
    assert.strictEqual(weapon.currentRounds, 2);
  });

  it('should replenish cylinder to full capacity and emit game:weapon-reloaded upon timer expiration', () => {
    const weapon = new Weapon({ currentRounds: 0 });
    weapon.startReload();

    let reloadedEvent = null;
    const unsubscribe = eventBus.subscribe('game:weapon-reloaded', (payload) => {
      reloadedEvent = payload;
    });

    // Advance 1.0s (0.8s remaining)
    weapon.update(1.0);
    assert.strictEqual(weapon.isReloading, true);
    assert.strictEqual(weapon.currentRounds, 0);

    // Advance another 0.85s (reload complete)
    weapon.update(0.85);
    assert.strictEqual(weapon.isReloading, false);
    assert.strictEqual(weapon.currentRounds, 6);
    assert.strictEqual(weapon.canShoot(), true);
    assert.ok(reloadedEvent !== null);
    assert.strictEqual(reloadedEvent.currentRounds, 6);

    unsubscribe();
  });

  it('should reset weapon to full capacity ready state with reset()', () => {
    const weapon = new Weapon({ currentRounds: 1 });
    weapon.startReload();
    assert.strictEqual(weapon.isReloading, true);

    weapon.reset();
    assert.strictEqual(weapon.currentRounds, 6);
    assert.strictEqual(weapon.isReloading, false);
    assert.strictEqual(weapon.throttleTimer, 0);
    assert.strictEqual(weapon.reloadTimer, 0);
    assert.strictEqual(weapon.canShoot(), true);
  });
});
