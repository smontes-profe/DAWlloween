/**
 * @file weapon.js
 * @description Weapon mechanics management for DAWlloween survival game.
 * Orchestrates 6-round cylinder capacity, rate-of-fire throttle, automatic & manual reload
 * cooldown timers, and decoupled EventBus state updates for the HUD.
 * Design Patterns: State Pattern, Observer (EventBus).
 * Standards: UK English (en-GB).
 */

import { eventBus } from '../utils/eventBus.js';

/**
 * Weapon mechanics controller.
 */
export class Weapon {
  /**
   * Initialises weapon attributes with survivalist 6-round revolver mechanics.
   *
   * @param {Object} [options={}] - Weapon configuration parameters.
   * @param {number} [options.maxRounds=6] - Total cylinder round capacity.
   * @param {number} [options.currentRounds=6] - Initial available rounds.
   * @param {number} [options.fireThrottle=0.20] - Minimum duration in seconds between consecutive shots.
   * @param {number} [options.reloadDuration=1.80] - Duration in seconds required to fully reload the cylinder.
   */
  constructor({
    maxRounds = 6,
    currentRounds = 6,
    fireThrottle = 0.20,
    reloadDuration = 1.80
  } = {}) {
    this.maxRounds = Math.max(1, Number(maxRounds));
    this.currentRounds = Math.min(this.maxRounds, Math.max(0, Number(currentRounds)));
    this.fireThrottle = Math.max(0.05, Number(fireThrottle));
    this.reloadDuration = Math.max(0.5, Number(reloadDuration));

    /** Remaining cooldown before weapon can fire again */
    this.throttleTimer = 0;
    /** Remaining duration for reload completion */
    this.reloadTimer = 0;
    /** Whether weapon is currently in reload state */
    this.isReloading = false;
  }

  /**
   * Determines whether the weapon can immediately discharge a projectile.
   *
   * @returns {boolean} True if ready to fire; false if reloading, empty, or throttled.
   */
  canShoot() {
    return !this.isReloading && this.currentRounds > 0 && this.throttleTimer <= 0;
  }

  /**
   * Discharges a single round from the cylinder if conditions allow.
   * Decrements round count, engages fire rate throttle, and initiates reload if depleted.
   *
   * @returns {boolean} True if shot was discharged successfully; false otherwise.
   */
  discharge() {
    if (!this.canShoot()) {
      return false;
    }

    this.currentRounds -= 1;
    this.throttleTimer = this.fireThrottle;

    // Publish ammo update notification
    this.publishAmmoState();

    // Trigger automatic reload if cylinder is spent
    if (this.currentRounds === 0) {
      this.startReload();
    }

    return true;
  }

  /**
   * Initiates cylinder reload cooldown.
   *
   * @returns {boolean} True if reload started; false if already reloading or already at full capacity.
   */
  startReload() {
    if (this.isReloading || this.currentRounds >= this.maxRounds) {
      return false;
    }

    this.isReloading = true;
    this.reloadTimer = this.reloadDuration;

    if (eventBus && typeof eventBus.publish === 'function') {
      eventBus.publish('game:weapon-reload-start', {
        currentRounds: this.currentRounds,
        maxRounds: this.maxRounds,
        duration: this.reloadDuration
      });
    }

    this.publishAmmoState();
    return true;
  }

  /**
   * Cancels active reload process if interrupted.
   */
  cancelReload() {
    if (this.isReloading) {
      this.isReloading = false;
      this.reloadTimer = 0;
      this.publishAmmoState();
    }
  }

  /**
   * Updates weapon cooldown and reload timers across frame elapsed time.
   *
   * @param {number} deltaTime - Frame duration in seconds.
   */
  update(deltaTime) {
    // 1. Decay fire rate throttle timer
    if (this.throttleTimer > 0) {
      this.throttleTimer -= deltaTime;
      if (this.throttleTimer < 0) {
        this.throttleTimer = 0;
      }
    }

    // 2. Process reload duration
    if (this.isReloading) {
      this.reloadTimer -= deltaTime;

      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.reloadTimer = 0;
        this.currentRounds = this.maxRounds;

        if (eventBus && typeof eventBus.publish === 'function') {
          eventBus.publish('game:weapon-reloaded', {
            currentRounds: this.currentRounds,
            maxRounds: this.maxRounds
          });
        }

        this.publishAmmoState();
      }
    }
  }

  /**
   * Publishes the current ammunition and reloading state through the EventBus.
   */
  publishAmmoState() {
    if (eventBus && typeof eventBus.publish === 'function') {
      eventBus.publish('game:ammo-updated', {
        currentRounds: this.currentRounds,
        maxRounds: this.maxRounds,
        isReloading: this.isReloading
      });
    }
  }

  /**
   * Resets weapon to full capacity ready state.
   */
  reset() {
    this.currentRounds = this.maxRounds;
    this.throttleTimer = 0;
    this.reloadTimer = 0;
    this.isReloading = false;
    this.publishAmmoState();
  }
}
