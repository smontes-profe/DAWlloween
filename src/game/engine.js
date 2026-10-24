/**
 * @file engine.js
 * @description 60 FPS HTML5 Canvas 2D Game Engine for the DAWlloween survival arena.
 * Orchestrates fixed/delta-time game loop, strict WASD keyboard movement, continuous
 * mouse aiming orientation, entity update/render lifecycles, and boundary enforcement.
 * Design Patterns: State Pattern, Observer / Decoupled Input & Render Architecture.
 * Language Standards: UK English (en-GB).
 */

import { EntityFactory, Player } from './entities.js';
import { Weapon } from './weapon.js';
import { eventBus } from '../utils/eventBus.js';

/**
 * Game engine lifecycle states.
 * @readonly
 * @enum {string}
 */
export const GAME_STATES = Object.freeze({
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED',
  TRIGGERED: 'TRIGGERED'
});

/**
 * Canvas 2D Game Engine core.
 */
export class GameEngine {
  /**
   * Initialises the game engine with configurable canvas dimensions and target frame timing.
   *
   * @param {Object} [options={}] - Engine configuration parameters.
   * @param {HTMLCanvasElement|null} [options.canvas=null] - Target HTML5 Canvas element.
   * @param {number} [options.width=1280] - Logical canvas arena width in pixels.
   * @param {number} [options.height=720] - Logical canvas arena height in pixels.
   * @param {Player|null} [options.player=null] - Optional pre-existing Player entity.
   * @param {Weapon|null} [options.weapon=null] - Optional pre-existing Weapon instance.
   */
  constructor({
    canvas = null,
    width = 1280,
    height = 720,
    player = null,
    weapon = null,
    survivalDuration = 60
  } = {}) {
    /** @type {HTMLCanvasElement|null} */
    this.canvas = canvas;
    /** @type {CanvasRenderingContext2D|null} */
    this.ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;

    /** @type {number} */
    this.width = width;
    /** @type {number} */
    this.height = height;

    /** @type {string} */
    this.state = GAME_STATES.IDLE;

    /** @type {Player} */
    this.player = player || EntityFactory.createPlayer({
      x: this.width / 2,
      y: this.height / 2
    });

    /** @type {Weapon} */
    this.weapon = weapon || new Weapon();

    /** @type {Array<Object>} Dynamic entities (e.g. projectiles, enemies) */
    this.projectiles = [];
    this.enemies = [];

    /** Active WASD pressed keys */
    this.activeKeys = new Set();

    /** Continuous mouse crosshair target coordinates in logical arena space */
    this.cursorX = this.width / 2;
    this.cursorY = this.height / 2;

    /** Visual kick/recoil timer for custom crosshair on firing */
    this.isFiringAnimationActive = false;
    this.firingAnimationTimer = 0;

    /** Animation frame request handle */
    this.animationFrameId = null;
    /** Timestamp of the previous frame in milliseconds */
    this.lastTimestamp = 0;

    /** Bound event handlers for clean attachment/detachment */
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleKeyUp = this.handleKeyUp.bind(this);
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    this.boundHandleMouseDown = this.handleMouseDown.bind(this);

    /** Progressive wave spawner properties (US1.6 / T16) */
    this.isSpawnerActive = true;
    this.gameElapsedTime = 0;
    this.spawnCooldownTimer = 0;
    this.baseSpawnInterval = 2.0;
    this.minSpawnInterval = 0.6;

    /** Survival countdown timer properties (US1.6 / T17) */
    this.survivalDuration = Math.max(1, Number(survivalDuration));
    this.remainingSeconds = this.survivalDuration;
    this.lastDispatchedSecond = -1;
    this.defeatedEnemiesCount = 0;
  }

  /**
   * Sets or updates the active canvas and its 2D rendering context.
   *
   * @param {HTMLCanvasElement} canvas - Target Canvas element.
   */
  setCanvas(canvas) {
    if (!canvas) return;
    this.canvas = canvas;
    this.ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    if (canvas.width) this.width = canvas.width;
    if (canvas.height) this.height = canvas.height;
  }

  /**
   * Initialises input event listeners for WASD keys and continuous mouse tracking.
   */
  attachInputListeners() {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('keydown', this.boundHandleKeyDown);
      window.addEventListener('keyup', this.boundHandleKeyUp);
    }

    if (this.canvas && typeof this.canvas.addEventListener === 'function') {
      this.canvas.addEventListener('mousemove', this.boundHandleMouseMove);
      this.canvas.addEventListener('mousedown', this.boundHandleMouseDown);
    } else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('mousemove', this.boundHandleMouseMove);
      window.addEventListener('mousedown', this.boundHandleMouseDown);
    }
  }

  /**
   * Detaches input event listeners to prevent memory leaks and zombie inputs.
   */
  detachInputListeners() {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('keydown', this.boundHandleKeyDown);
      window.removeEventListener('keyup', this.boundHandleKeyUp);
      window.removeEventListener('mousemove', this.boundHandleMouseMove);
      window.removeEventListener('mousedown', this.boundHandleMouseDown);
    }

    if (this.canvas && typeof this.canvas.removeEventListener === 'function') {
      this.canvas.removeEventListener('mousemove', this.boundHandleMouseMove);
      this.canvas.removeEventListener('mousedown', this.boundHandleMouseDown);
    }

    this.activeKeys.clear();
  }

  /**
   * Handles keyboard keydown event.
   * Strictly registers WASD movement keys and explicitly ignores arrow keys.
   *
   * @param {KeyboardEvent} event - Keyboard event.
   */
  handleKeyDown(event) {
    if (!event || !event.code) return;

    const code = event.code;
    // Strict WASD mapping; arrow keys are explicitly excluded
    if (code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD') {
      this.activeKeys.add(code);
    } else if (code === 'KeyR') {
      // Manual reload trigger
      if (this.weapon && typeof this.weapon.startReload === 'function') {
        this.weapon.startReload();
      }
    }
  }

  /**
   * Handles keyboard keyup event.
   *
   * @param {KeyboardEvent} event - Keyboard event.
   */
  handleKeyUp(event) {
    if (!event || !event.code) return;

    const code = event.code;
    if (code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD') {
      this.activeKeys.delete(code);
    }
  }

  /**
   * Handles mouse move events, projecting client coordinates into the logical arena canvas space
   * and continuously orienting the player towards the crosshair coordinates.
   *
   * @param {MouseEvent} event - Mouse event.
   */
  handleMouseMove(event) {
    if (!event) return;

    if (this.canvas && typeof this.canvas.getBoundingClientRect === 'function') {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = rect.width > 0 ? this.width / rect.width : 1;
      const scaleY = rect.height > 0 ? this.height / rect.height : 1;

      this.cursorX = (event.clientX - rect.left) * scaleX;
      this.cursorY = (event.clientY - rect.top) * scaleY;
    } else {
      this.cursorX = event.clientX ?? this.cursorX;
      this.cursorY = event.clientY ?? this.cursorY;
    }

    // Continuously orient player towards mouse coordinates
    if (this.player && typeof this.player.lookAt === 'function') {
      this.player.lookAt(this.cursorX, this.cursorY);
    }
  }

  /**
   * Handles mouse down events for discharging weapon projectiles.
   * Strictly fires on primary left-click (event.button === 0).
   *
   * @param {MouseEvent} event - Mouse event.
   */
  handleMouseDown(event) {
    if (!event || event.button !== 0) return;
    if (this.state !== GAME_STATES.RUNNING) return;

    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    this.triggerShoot();
  }

  /**
   * Discharges a weapon shot towards current crosshair coordinates,
   * activating crosshair recoil animation and dispatching decoupled eventBus notification.
   *
   * @returns {boolean} True if shot was triggered; false if blocked.
   */
  triggerShoot() {
    if (this.state !== GAME_STATES.RUNNING) return false;

    // Check weapon ammo, rate throttle, and reload cooldown
    if (this.weapon && typeof this.weapon.discharge === 'function') {
      const discharged = this.weapon.discharge();
      if (!discharged) {
        return false;
      }
    }

    // Trigger visual crosshair recoil expansion
    this.isFiringAnimationActive = true;
    this.firingAnimationTimer = 0.08;

    const originX = this.player ? this.player.x : this.width / 2;
    const originY = this.player ? this.player.y : this.height / 2;
    const targetX = this.cursorX;
    const targetY = this.cursorY;
    const angle = this.player ? this.player.angle : Math.atan2(targetY - originY, targetX - originX);

    // Spawn ballistic projectile originating from player position
    const projectile = EntityFactory.createProjectile({
      x: originX,
      y: originY,
      angle,
      speed: 750
    });
    this.projectiles.push(projectile);

    if (eventBus && typeof eventBus.publish === 'function') {
      eventBus.publish('game:player-shoot', {
        originX,
        originY,
        targetX,
        targetY,
        angle,
        projectile
      });
    }

    return true;
  }

  /**
   * Computes current directional movement vector based exclusively on active WASD keys.
   *
   * @returns {{ moveX: number, moveY: number }} Direction components in range [-1, 1].
   */
  computeInputDirection() {
    let moveX = 0;
    let moveY = 0;

    if (this.activeKeys.has('KeyW')) moveY -= 1;
    if (this.activeKeys.has('KeyS')) moveY += 1;
    if (this.activeKeys.has('KeyA')) moveX -= 1;
    if (this.activeKeys.has('KeyD')) moveX += 1;

    return { moveX, moveY };
  }

  /**
   * Generates a coordinate situated along the arena perimeter outside the visible viewport.
   *
   * @param {number} [offset=24] - Distance in pixels outside arena borders.
   * @returns {{ x: number, y: number }} Perimeter coordinate.
   */
  getPerimeterSpawnPoint(offset = 24) {
    // 0: North, 1: South, 2: West, 3: East
    const side = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;

    switch (side) {
      case 0: // North
        x = Math.random() * this.width;
        y = -offset;
        break;
      case 1: // South
        x = Math.random() * this.width;
        y = this.height + offset;
        break;
      case 2: // West
        x = -offset;
        y = Math.random() * this.height;
        break;
      case 3: // East
      default:
        x = this.width + offset;
        y = Math.random() * this.height;
        break;
    }

    return { x, y };
  }

  /**
   * Selects an enemy archetype based on survival time progression.
   *
   * @param {number} elapsedTime - Total elapsed seconds in survival session.
   * @returns {string} Archetype key ('zombie', 'ghost', 'brute').
   */
  selectEnemyArchetype(elapsedTime) {
    const roll = Math.random();

    if (elapsedTime < 15) {
      // Early wave: predominantly shambling zombies, occasional swift ghost
      return roll < 0.8 ? 'zombie' : 'ghost';
    }

    if (elapsedTime < 35) {
      // Mid wave: mix of zombies, ghosts, and early brute tanks
      if (roll < 0.5) return 'zombie';
      if (roll < 0.85) return 'ghost';
      return 'brute';
    }

    // Climax / late wave: high intensity
    if (roll < 0.35) return 'zombie';
    if (roll < 0.7) return 'ghost';
    return 'brute';
  }

  /**
   * Calculates dynamic spawn delay based on elapsed survival time.
   *
   * @param {number} elapsedTime - Total elapsed time in seconds.
   * @returns {number} Seconds until next spawn.
   */
  calculateSpawnInterval(elapsedTime) {
    const progress = Math.min(Math.max(elapsedTime / 60, 0), 1);
    const interval = this.baseSpawnInterval - progress * (this.baseSpawnInterval - this.minSpawnInterval);
    return Math.max(this.minSpawnInterval, Math.round(interval * 1000) / 1000);
  }

  /**
   * Calculates maximum simultaneous active enemies to prevent framerate dips.
   *
   * @param {number} elapsedTime - Total elapsed time in seconds.
   * @returns {number} Allowed maximum active enemies.
   */
  calculateMaxConcurrentEnemies(elapsedTime) {
    const progress = Math.min(Math.max(elapsedTime / 60, 0), 1);
    return Math.min(20, Math.floor(5 + progress * 15));
  }

  /**
   * Instantiates a new enemy on the arena perimeter and adds it to the active pool.
   *
   * @returns {Object|null} The spawned enemy entity or null if capacity reached.
   */
  spawnEnemy() {
    const maxEnemies = this.calculateMaxConcurrentEnemies(this.gameElapsedTime);
    const aliveCount = this.enemies.filter((e) => e && e.isAlive).length;

    if (aliveCount >= maxEnemies) {
      return null;
    }

    const archetype = this.selectEnemyArchetype(this.gameElapsedTime);
    const spawnPos = this.getPerimeterSpawnPoint();

    const enemy = EntityFactory.createEnemy(archetype, {
      x: spawnPos.x,
      y: spawnPos.y
    });

    this.enemies.push(enemy);

    if (eventBus && typeof eventBus.publish === 'function') {
      eventBus.publish('game:enemy-spawned', {
        enemy,
        archetype,
        x: spawnPos.x,
        y: spawnPos.y
      });
    }

    return enemy;
  }

  /**
   * Progresses the enemy wave spawner over delta-time.
   *
   * @param {number} deltaTime - Frame duration in seconds.
   */
  updateSpawner(deltaTime) {
    if (!this.isSpawnerActive) {
      return;
    }

    this.spawnCooldownTimer -= deltaTime;

    if (this.spawnCooldownTimer <= 0) {
      this.spawnEnemy();
      this.spawnCooldownTimer = this.calculateSpawnInterval(this.gameElapsedTime);
    }
  }

  /**
   * Resets spawner elapsed time, cooldown timers, active enemies pool, and countdown timer.
   */
  resetSpawner() {
    this.gameElapsedTime = 0;
    this.spawnCooldownTimer = 0;
    this.enemies = [];
    this.remainingSeconds = this.survivalDuration;
    this.lastDispatchedSecond = -1;
    this.defeatedEnemiesCount = 0;
  }

  /**
   * Evaluates collision detection between active projectiles and enemy entities.
   * Marks colliding projectiles as dead and dispatches collision notifications.
   *
   * @returns {Array<{ projectile: Object, enemy: Object }>} Collisions registered this frame.
   */
  checkProjectileCollisions() {
    const hits = [];

    for (let pIdx = this.projectiles.length - 1; pIdx >= 0; pIdx--) {
      const projectile = this.projectiles[pIdx];
      if (!projectile || !projectile.isAlive) continue;

      for (let eIdx = 0; eIdx < this.enemies.length; eIdx++) {
        const enemy = this.enemies[eIdx];
        if (!enemy || !enemy.isAlive) continue;

        if (projectile.collidesWith(enemy)) {
          projectile.isAlive = false;
          hits.push({ projectile, enemy });

          const wasDefeated = typeof enemy.takeDamage === 'function'
            ? enemy.takeDamage(projectile.damage || 1)
            : true;

          if (eventBus && typeof eventBus.publish === 'function') {
            eventBus.publish('game:projectile-hit', {
              projectile,
              enemy,
              damage: projectile.damage || 1,
              defeated: wasDefeated
            });

            if (wasDefeated) {
              this.defeatedEnemiesCount += 1;
              eventBus.publish('game:enemy-defeated', {
                enemy,
                scoreValue: enemy.scoreValue || 10,
                x: enemy.x,
                y: enemy.y,
                type: enemy.type
              });
            }
          }
          break;
        }
      }
    }

    return hits;
  }

  /**
   * Core simulation update step for a given delta-time slice.
   *
   * @param {number} deltaTime - Frame duration in seconds (capped defensively).
   */
  update(deltaTime) {
    if (this.state !== GAME_STATES.RUNNING) return;

    // 0. Advance total session elapsed time
    this.gameElapsedTime += deltaTime;

    // 0.1. Update weapon reload and fire rate throttle timers
    if (this.weapon && typeof this.weapon.update === 'function') {
      this.weapon.update(deltaTime);
    }

    // 0.2. Update crosshair recoil animation timer
    if (this.isFiringAnimationActive) {
      this.firingAnimationTimer -= deltaTime;
      if (this.firingAnimationTimer <= 0) {
        this.isFiringAnimationActive = false;
        this.firingAnimationTimer = 0;
      }
    }

    // 0.3. Progress progressive wave spawner
    this.updateSpawner(deltaTime);

    // 0.3. Progress survival countdown timer
    this.remainingSeconds = Math.max(0, this.survivalDuration - this.gameElapsedTime);
    const currentFloorSecond = Math.ceil(this.remainingSeconds);
    if (currentFloorSecond !== this.lastDispatchedSecond) {
      this.lastDispatchedSecond = currentFloorSecond;
      if (eventBus && typeof eventBus.publish === 'function') {
        eventBus.publish('game:timer-tick', {
          remainingSeconds: this.remainingSeconds,
          totalSeconds: this.survivalDuration,
          currentSecond: currentFloorSecond
        });

        if (this.remainingSeconds <= 0) {
          eventBus.publish('game:timer-expired', {
            survivalDuration: this.survivalDuration
          });
        }
      }
    }

    // Climax Trigger: Timer expiration
    if (this.remainingSeconds <= 0) {
      this.triggerClimax('timer_expired');
      return;
    }

    // 1. Move player using exclusively WASD directional inputs and arena bounds
    const inputDirection = this.computeInputDirection();
    const arenaBounds = { width: this.width, height: this.height };

    if (this.player && typeof this.player.move === 'function') {
      this.player.move(deltaTime, inputDirection, arenaBounds);
      // Ensure player maintains orientation towards mouse cursor
      this.player.lookAt(this.cursorX, this.cursorY);
    }

    // 2. Update projectiles and boundary despawning
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      if (projectile && typeof projectile.update === 'function') {
        projectile.update(deltaTime, arenaBounds);
      }
      if (!projectile.isAlive) {
        this.projectiles.splice(i, 1);
      }
    }

    // 3. Evaluate collisions between projectiles and enemies
    this.checkProjectileCollisions();

    // 4. Update enemies and pursue player
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy && enemy.isAlive) {
        if (typeof enemy.pursue === 'function' && this.player) {
          enemy.pursue(this.player.x, this.player.y, deltaTime);
        } else if (typeof enemy.update === 'function') {
          enemy.update(deltaTime, this.player);
        }

        // Check if enemy touches player
        if (this.player && this.player.isAlive && typeof enemy.checkCollision === 'function') {
          if (enemy.checkCollision(this.player)) {
            const damage = enemy.damage || 25;
            let playerDefeated = false;
            if (typeof this.player.takeDamage === 'function') {
              playerDefeated = this.player.takeDamage(damage);
            } else {
              this.player.health = Math.max(0, (this.player.health || 0) - damage);
              if (this.player.health <= 0) {
                this.player.isAlive = false;
                playerDefeated = true;
              }
            }

            if (eventBus && typeof eventBus.publish === 'function') {
              eventBus.publish('game:player-hit', {
                enemy,
                player: this.player,
                damage,
                playerDefeated
              });
            }

            // Climax Trigger: Player defeat
            if (playerDefeated) {
              this.triggerClimax('player_defeat');
              return;
            }
          }
        }
      }

      if (!enemy || !enemy.isAlive) {
        this.enemies.splice(i, 1);
      }
    }
  }

  /**
   * Renders a custom Halloween-themed crosshair at current cursor coordinates.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context.
   */
  renderCrosshair(ctx) {
    if (!ctx) return;

    const x = this.cursorX;
    const y = this.cursorY;
    const isRecoil = this.isFiringAnimationActive;
    const radius = isRecoil ? 14 : 10;
    const colour = isRecoil ? '#ff7518' : '#39ff14'; // Pumpkin orange during recoil, ectoplasm green normally

    ctx.save();
    ctx.translate(x, y);

    // Center targeting pip
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.closePath();

    // Outer precision ring
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.closePath();

    // Cardinal tick marks
    const gap = radius + 2;
    const tickLen = isRecoil ? 6 : 4;

    ctx.beginPath();
    // North tick
    ctx.moveTo(0, -gap);
    ctx.lineTo(0, -gap - tickLen);
    // South tick
    ctx.moveTo(0, gap);
    ctx.lineTo(0, gap + tickLen);
    // West tick
    ctx.moveTo(-gap, 0);
    ctx.lineTo(-gap - tickLen, 0);
    // East tick
    ctx.moveTo(gap, 0);
    ctx.lineTo(gap + tickLen, 0);

    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.closePath();

    ctx.restore();
  }

  /**
   * Core rendering pass drawing background arena, entities, and crosshair.
   */
  render() {
    if (!this.ctx) return;

    const ctx = this.ctx;

    // 1. Clear and render atmospheric Halloween arena background
    ctx.save();
    ctx.fillStyle = '#0d0914'; // Dark gothic arena background
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle arena grid lines for depth perception
    ctx.strokeStyle = 'rgba(74, 20, 140, 0.15)'; // Deep spectral purple
    ctx.lineWidth = 1;
    const gridSize = 64;

    ctx.beginPath();
    for (let x = 0; x <= this.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let y = 0; y <= this.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();
    ctx.closePath();

    // Subtle arena boundary danger border
    ctx.strokeStyle = 'rgba(255, 117, 24, 0.4)'; // Pumpkin orange border
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, this.width - 4, this.height - 4);
    ctx.restore();

    // 2. Render dynamic entities (projectiles & enemies)
    for (const enemy of this.enemies) {
      if (enemy && typeof enemy.render === 'function') {
        enemy.render(ctx);
      }
    }

    for (const projectile of this.projectiles) {
      if (projectile && typeof projectile.render === 'function') {
        projectile.render(ctx);
      }
    }

    // 3. Render Player entity with directional torchlight beam
    if (this.player && typeof this.player.render === 'function') {
      this.player.render(ctx);
    }

    // 4. Render custom animated crosshair cursor
    this.renderCrosshair(ctx);
  }

  /**
   * Main game loop driver invoked every animation frame.
   *
   * @param {number} timestamp - High resolution DOMHighResTimeStamp.
   */
  gameLoop(timestamp) {
    if (this.state !== GAME_STATES.RUNNING) {
      return;
    }

    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
    }

    // Compute delta-time in seconds and apply defensive clamp (max 100ms / 0.1s)
    const rawDelta = (timestamp - this.lastTimestamp) / 1000;
    const deltaTime = Math.min(Math.max(rawDelta, 0), 0.1);
    this.lastTimestamp = timestamp;

    this.update(deltaTime);
    this.render();

    this.scheduleNextFrame();
  }

  /**
   * Schedules the next frame using requestAnimationFrame when available.
   */
  scheduleNextFrame() {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      this.animationFrameId = window.requestAnimationFrame((ts) => this.gameLoop(ts));
    } else if (typeof globalThis !== 'undefined' && typeof globalThis.requestAnimationFrame === 'function') {
      this.animationFrameId = globalThis.requestAnimationFrame((ts) => this.gameLoop(ts));
    } else {
      this.animationFrameId = null;
    }
  }

  /**
   * Starts or resumes the game engine simulation and attaches listeners.
   */
  start() {
    if (this.state === GAME_STATES.RUNNING || this.state === GAME_STATES.TRIGGERED) {
      return;
    }

    this.state = GAME_STATES.RUNNING;
    this.lastTimestamp = 0;
    this.attachInputListeners();
    if (this.weapon && typeof this.weapon.publishAmmoState === 'function') {
      this.weapon.publishAmmoState();
    }
    this.scheduleNextFrame();
  }

  /**
   * Pauses the game loop without clearing entity states.
   */
  pause() {
    if (this.state !== GAME_STATES.RUNNING) {
      return;
    }

    this.state = GAME_STATES.PAUSED;
    this.cancelLoop();
  }

  /**
   * Resumes the game loop from a paused state.
   */
  resume() {
    if (this.state !== GAME_STATES.PAUSED) {
      return;
    }

    this.state = GAME_STATES.RUNNING;
    this.lastTimestamp = 0;
    this.scheduleNextFrame();
  }

  /**
   * Triggers the game climax jumpscare sequence, immediately halting the game loop,
   * detaching input listeners, transitioning state to TRIGGERED, and publishing
   * the decoupled game:trigger-screamer event payload for EPIC2 consumption.
   *
   * @param {string} [reason='timer_expired'] - Reason for climax ('timer_expired' or 'player_defeat').
   * @returns {Object|null} Published screamer payload, or null if already triggered.
   */
  triggerClimax(reason = 'timer_expired') {
    if (this.state === GAME_STATES.TRIGGERED) {
      return null;
    }

    this.state = GAME_STATES.TRIGGERED;
    this.cancelLoop();
    this.detachInputListeners();

    const payload = {
      reason,
      elapsedTime: Math.round(this.gameElapsedTime * 1000) / 1000,
      survivalDuration: this.survivalDuration,
      enemiesDefeated: this.defeatedEnemiesCount,
      timestamp: Date.now()
    };

    if (eventBus && typeof eventBus.publish === 'function') {
      eventBus.publish('game:trigger-screamer', payload);
    }

    return payload;
  }

  /**
   * Cancels the active animation frame handle.
   */
  cancelLoop() {
    if (this.animationFrameId !== null) {
      if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(this.animationFrameId);
      } else if (typeof globalThis !== 'undefined' && typeof globalThis.cancelAnimationFrame === 'function') {
        globalThis.cancelAnimationFrame(this.animationFrameId);
      } else {
        clearTimeout(this.animationFrameId);
      }
      this.animationFrameId = null;
    }
  }

  /**
   * Stops the game engine and resets inputs.
   */
  stop() {
    this.state = GAME_STATES.STOPPED;
    this.cancelLoop();
    this.detachInputListeners();
  }

  /**
   * Completely destroys engine instance, detaching all listeners and releasing resources.
   */
  destroy() {
    this.stop();
    this.resetSpawner();
    this.canvas = null;
    this.ctx = null;
    this.projectiles = [];
    this.enemies = [];
    this.state = GAME_STATES.STOPPED;
  }
}
