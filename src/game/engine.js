/**
 * @file engine.js
 * @description 60 FPS HTML5 Canvas 2D Game Engine for the DAWlloween survival arena.
 * Orchestrates fixed/delta-time game loop, strict WASD keyboard movement, continuous
 * mouse aiming orientation, entity update/render lifecycles, and boundary enforcement.
 * Design Patterns: State Pattern, Observer / Decoupled Input & Render Architecture.
 * Language Standards: UK English (en-GB).
 */

import { EntityFactory, Player } from './entities.js';

/**
 * Game engine lifecycle states.
 * @readonly
 * @enum {string}
 */
export const GAME_STATES = Object.freeze({
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED'
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
   */
  constructor({
    canvas = null,
    width = 1280,
    height = 720,
    player = null
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

    /** @type {Array<Object>} Dynamic entities (e.g. projectiles, enemies) */
    this.projectiles = [];
    this.enemies = [];

    /** Active WASD pressed keys */
    this.activeKeys = new Set();

    /** Continuous mouse crosshair target coordinates in logical arena space */
    this.cursorX = this.width / 2;
    this.cursorY = this.height / 2;

    /** Animation frame request handle */
    this.animationFrameId = null;
    /** Timestamp of the previous frame in milliseconds */
    this.lastTimestamp = 0;

    /** Bound event handlers for clean attachment/detachment */
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleKeyUp = this.handleKeyUp.bind(this);
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
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
    } else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('mousemove', this.boundHandleMouseMove);
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
    }

    if (this.canvas && typeof this.canvas.removeEventListener === 'function') {
      this.canvas.removeEventListener('mousemove', this.boundHandleMouseMove);
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
   * Core simulation update step for a given delta-time slice.
   *
   * @param {number} deltaTime - Frame duration in seconds (capped defensively).
   */
  update(deltaTime) {
    if (this.state !== GAME_STATES.RUNNING) return;

    // 1. Move player using exclusively WASD directional inputs and arena bounds
    const inputDirection = this.computeInputDirection();
    const arenaBounds = { width: this.width, height: this.height };

    if (this.player && typeof this.player.move === 'function') {
      this.player.move(deltaTime, inputDirection, arenaBounds);
      // Ensure player maintains orientation towards mouse cursor
      this.player.lookAt(this.cursorX, this.cursorY);
    }

    // 2. Update projectiles (open for US1.4)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      if (projectile && typeof projectile.update === 'function') {
        projectile.update(deltaTime);
      }
      if (!projectile.isAlive) {
        this.projectiles.splice(i, 1);
      }
    }

    // 3. Update enemies (open for US1.6)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy && typeof enemy.update === 'function') {
        enemy.update(deltaTime, this.player);
      }
      if (!enemy.isAlive) {
        this.enemies.splice(i, 1);
      }
    }
  }

  /**
   * Core rendering pass drawing background arena and game entities.
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
    if (this.state === GAME_STATES.RUNNING) {
      return;
    }

    this.state = GAME_STATES.RUNNING;
    this.lastTimestamp = 0;
    this.attachInputListeners();
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
    this.canvas = null;
    this.ctx = null;
    this.projectiles = [];
    this.enemies = [];
    this.state = GAME_STATES.STOPPED;
  }
}
