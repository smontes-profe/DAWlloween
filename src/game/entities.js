/**
 * @file entities.js
 * @description Base entity classes, Player entity, and extensible Entity Factory
 * for the DAWlloween 2D Canvas survival arena game.
 * Design Patterns: Factory Pattern, Inheritance / Polymorphic Entities.
 * Language Standards: UK English (en-GB).
 */

import { GAME_CONFIG } from '../config.js';

/**
 * Normalises a 2D vector [x, y] to have a length of 1 if its magnitude is non-zero.
 * Prevents faster diagonal movement (the 1.414x diagonal speed problem).
 *
 * @param {number} x - Horizontal vector component.
 * @param {number} y - Vertical vector component.
 * @returns {{ x: number, y: number, magnitude: number }} Normalised vector components and original magnitude.
 */
export function normaliseVector(x, y) {
  const magnitude = Math.hypot(x, y);
  if (magnitude === 0) {
    return { x: 0, y: 0, magnitude: 0 };
  }
  return {
    x: x / magnitude,
    y: y / magnitude,
    magnitude
  };
}

/**
 * Calculates Euclidean distance between two points or entities.
 *
 * @param {number} x1 - First horizontal coordinate.
 * @param {number} y1 - First vertical coordinate.
 * @param {number} x2 - Second horizontal coordinate.
 * @param {number} y2 - Second vertical coordinate.
 * @returns {number} Euclidean distance.
 */
export function calculateDistance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * Calculates the orientation angle (in radians) from origin (x1, y1) towards target (x2, y2).
 *
 * @param {number} x1 - Source horizontal coordinate.
 * @param {number} y1 - Source vertical coordinate.
 * @param {number} x2 - Target horizontal coordinate.
 * @param {number} y2 - Target vertical coordinate.
 * @returns {number} Angle in radians.
 */
export function calculateAngle(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * Abstract base class for all game entities in the arena.
 */
export class Entity {
  /**
   * Initialises common entity attributes.
   *
   * @param {Object} options - Configuration options.
   * @param {number} [options.x=0] - Initial horizontal coordinate.
   * @param {number} [options.y=0] - Initial vertical coordinate.
   * @param {number} [options.radius=16] - Collision radius in pixels.
   * @param {number} [options.speed=200] - Movement speed in pixels per second.
   * @param {number} [options.angle=0] - Orientation angle in radians.
   * @param {string} [options.colour='#ff7518'] - Primary entity colour (UK English).
   * @param {string} [options.type='entity'] - Entity discriminator type.
   */
  constructor({
    x = 0,
    y = 0,
    radius = 16,
    speed = 200,
    angle = 0,
    colour = '#ff7518',
    type = 'entity'
  } = {}) {
    this.x = Number(x);
    this.y = Number(y);
    this.vx = 0;
    this.vy = 0;
    this.radius = Math.max(1, Number(radius));
    this.speed = Math.max(0, Number(speed));
    this.angle = Number(angle);
    this.colour = colour;
    this.type = type;
    this.isAlive = true;
  }

  /**
   * Updates entity physics and state over time.
   *
   * @param {number} deltaTime - Elapsed time since last frame in seconds.
   */
  update(deltaTime) {
    if (!this.isAlive) return;
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
  }

  /**
   * Renders the entity onto the 2D Canvas context.
   * Subclasses should override this method to provide specific visual styles.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context.
   */
  render(ctx) {
    if (!this.isAlive || !ctx) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.colour;
    ctx.fill();
    ctx.closePath();
    ctx.restore();
  }

  /**
   * Restricts the entity position within arena boundary coordinates,
   * respecting its collision radius.
   *
   * @param {number} arenaWidth - Total width of the arena.
   * @param {number} arenaHeight - Total height of the arena.
   */
  clampToBounds(arenaWidth, arenaHeight) {
    if (typeof arenaWidth !== 'number' || typeof arenaHeight !== 'number') {
      return;
    }
    const minX = this.radius;
    const maxX = Math.max(minX, arenaWidth - this.radius);
    const minY = this.radius;
    const maxY = Math.max(minY, arenaHeight - this.radius);

    this.x = Math.min(Math.max(this.x, minX), maxX);
    this.y = Math.min(Math.max(this.y, minY), maxY);
  }

  /**
   * Determines whether this entity collides with another circular entity.
   *
   * @param {Entity} other - Target entity to test collision against.
   * @returns {boolean} True if circular hitboxes overlap.
   */
  collidesWith(other) {
    if (!other || !this.isAlive || !other.isAlive) {
      return false;
    }
    const distance = calculateDistance(this.x, this.y, other.x, other.y);
    return distance < this.radius + other.radius;
  }
}

/**
 * Player character entity with 8-directional movement, cursor orientation,
 * and flashlight/torch atmospheric rendering.
 */
export class Player extends Entity {
  /**
   * Initialises the player entity with survivalist defaults.
   *
   * @param {Object} [options={}] - Player configuration overrides.
   */
  constructor(options = {}) {
    super({
      radius: 18,
      speed: 240,
      colour: '#ff7518', // Pumpkin orange design token
      type: 'player',
      ...options
    });

    /** Secondary accent colour for torchlight/glow */
    this.glowColour = options.glowColour || '#39ff14'; // Ectoplasm green
    /** Player health or hit points (5 discrete HP as per US6.2) */
    const defaultHp = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.initialHp) ? GAME_CONFIG.initialHp : 5;
    const defaultMaxHp = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.maxHp) ? GAME_CONFIG.maxHp : 5;
    this.health = options.health ?? defaultHp;
    this.maxHealth = options.maxHealth ?? defaultMaxHp;
  }

  /**
   * Applies damage to player, reducing health towards zero and marking defeat.
   *
   * @param {number} [amount=1] - Amount of damage inflicted.
   * @returns {boolean} True if player was defeated by this blow.
   */
  takeDamage(amount = 1) {
    if (!this.isAlive) return false;
    const damage = Math.max(0, Number(amount) || 0);
    this.health = Math.max(0, this.health - damage);
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      return true;
    }
    return false;
  }

  /**
   * Adjusts player orientation angle towards target coordinate (e.g. mouse crosshair).
   *
   * @param {number} targetX - Target horizontal coordinate in arena space.
   * @param {number} targetY - Target vertical coordinate in arena space.
   */
  lookAt(targetX, targetY) {
    if (typeof targetX === 'number' && typeof targetY === 'number') {
      this.angle = calculateAngle(this.x, this.y, targetX, targetY);
    }
  }

  /**
   * Updates player position based on directional input vectors and arena constraints.
   *
   * @param {number} deltaTime - Frame duration in seconds.
   * @param {{ moveX: number, moveY: number }} [inputDirection={ moveX: 0, moveY: 0 }] - Input movement axes (-1 to 1).
   * @param {{ width: number, height: number }} [arenaBounds=null] - Optional boundary constraints to clamp.
   */
  move(deltaTime, inputDirection = { moveX: 0, moveY: 0 }, arenaBounds = null) {
    if (!this.isAlive) return;

    const { moveX = 0, moveY = 0 } = inputDirection;
    const { x: dirX, y: dirY } = normaliseVector(moveX, moveY);

    this.vx = dirX * this.speed;
    this.vy = dirY * this.speed;

    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;

    if (arenaBounds && typeof arenaBounds.width === 'number' && typeof arenaBounds.height === 'number') {
      this.clampToBounds(arenaBounds.width, arenaBounds.height);
    }
  }

  /**
   * Renders the player entity with a directional torchlight beam and glowing survivor avatar.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context.
   */
  render(ctx) {
    if (!this.isAlive || !ctx) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // 1. Draw directional torchlight / flashlight cone
    const torchLength = 110;
    const torchSpread = Math.PI / 4.5; // ~40 degree cone

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, torchLength, -torchSpread / 2, torchSpread / 2);
    ctx.closePath();

    const torchGradient = ctx.createRadialGradient(0, 0, this.radius, 0, 0, torchLength);
    torchGradient.addColorStop(0, 'rgba(255, 235, 179, 0.45)');
    torchGradient.addColorStop(0.6, 'rgba(255, 183, 77, 0.20)');
    torchGradient.addColorStop(1, 'rgba(255, 117, 24, 0)');
    ctx.fillStyle = torchGradient;
    ctx.fill();
    ctx.restore();

    // 2. Draw outer spectral glow ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.35)'; // Ectoplasmic green aura
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();
    ctx.restore();

    // 3. Draw player body (survivor pumpkin silhouette)
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.colour; // Pumpkin orange
    ctx.shadowColor = '#ff7518';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#261138';
    ctx.stroke();
    ctx.closePath();
    ctx.restore();

    // 4. Draw weapon / torch barrel pointing forward
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.radius * 0.4, -3, this.radius * 0.8, 6);
    ctx.fillStyle = '#f5f5f5';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#120d18';
    ctx.stroke();
    ctx.closePath();
    ctx.restore();

    // 5. Directional eye / visor slit for personality
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.radius * 0.2, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#39ff14';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.closePath();
    ctx.restore();

    ctx.restore();
  }
}

/**
 * Projectile entity representing discharged weapon rounds.
 * Moves with linear ballistic velocity, tracks recent positions for tracer trail,
 * and despawns automatically upon leaving arena boundaries.
 */
export class Projectile extends Entity {
  /**
   * Initialises the projectile with ballistic velocity and Halloween styling.
   *
   * @param {Object} [options={}] - Configuration options.
   * @param {number} [options.x=0] - Initial horizontal coordinate.
   * @param {number} [options.y=0] - Initial vertical coordinate.
   * @param {number} [options.angle=0] - Travel trajectory angle in radians.
   * @param {number} [options.speed=750] - Velocity in pixels per second.
   * @param {number} [options.radius=4] - Collision hitbox radius in pixels.
   * @param {number} [options.damage=25] - Damage dealt on impact.
   * @param {string} [options.colour='#ffb74d'] - Bullet colour (spectral amber / golden spark).
   */
  constructor({
    x = 0,
    y = 0,
    angle = 0,
    speed = 750,
    radius = 4,
    damage = 25,
    colour = '#ffb74d',
    ...rest
  } = {}) {
    super({
      x,
      y,
      radius,
      speed,
      angle,
      colour,
      type: 'projectile',
      ...rest
    });

    this.damage = Math.max(1, Number(damage));
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;

    /** Recent position trail history for motion blur / ballistic tracer */
    this.trail = [];
    this.maxTrailLength = 4;
  }

  /**
   * Updates projectile position and records trail history.
   *
   * @param {number} deltaTime - Elapsed frame duration in seconds.
   * @param {{ width: number, height: number }|null} [arenaBounds=null] - Optional arena dimensions for despawn.
   */
  update(deltaTime, arenaBounds = null) {
    if (!this.isAlive) return;

    // Record trail position
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }

    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;

    if (arenaBounds && typeof arenaBounds.width === 'number' && typeof arenaBounds.height === 'number') {
      this.checkBounds(arenaBounds.width, arenaBounds.height);
    }
  }

  /**
   * Checks whether the projectile has exited the visible arena boundaries,
   * marking it as dead so it can be pruned by the engine.
   *
   * @param {number} arenaWidth - Total width of the arena.
   * @param {number} arenaHeight - Total height of the arena.
   * @returns {boolean} True if within bounds; false if despawned.
   */
  checkBounds(arenaWidth, arenaHeight) {
    if (
      this.x < -this.radius ||
      this.x > arenaWidth + this.radius ||
      this.y < -this.radius ||
      this.y > arenaHeight + this.radius
    ) {
      this.isAlive = false;
      return false;
    }
    return true;
  }

  /**
   * Renders the projectile with a luminous tracer tail and glowing core.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context.
   */
  render(ctx) {
    if (!this.isAlive || !ctx) return;

    ctx.save();

    // 1. Draw glowing ballistic tracer tail
    if (this.trail.length > 0) {
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.lineTo(this.x, this.y);
      ctx.strokeStyle = 'rgba(255, 183, 77, 0.4)'; // Amber motion blur
      ctx.lineWidth = this.radius * 1.2;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.closePath();
    }

    // 2. Draw glowing bullet core
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.colour;
    ctx.shadowColor = '#ffb74d';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.closePath();

    ctx.restore();
  }
}

/**
 * Base Enemy entity with pursuit AI, health management, and collision detection.
 */
export class Enemy extends Entity {
  /**
   * Initialises the base enemy.
   *
   * @param {Object} [options={}] - Configuration options.
   * @param {number} [options.x=0] - Horizontal spawn coordinate.
   * @param {number} [options.y=0] - Vertical spawn coordinate.
   * @param {number} [options.radius=16] - Hitbox radius in pixels.
   * @param {number} [options.speed=80] - Pursuit speed in pixels per second.
   * @param {number} [options.health=1] - Hits sustained before defeat.
   * @param {number} [options.damage=1] - Damage inflicted on collision.
   * @param {number} [options.scoreValue=10] - Points yielded on defeat.
   * @param {string} [options.colour='#39ff14'] - Primary colour (UK English).
   * @param {string} [options.type='enemy'] - Specific enemy archetype.
   */
  constructor({
    x = 0,
    y = 0,
    radius = 16,
    speed = 80,
    health = 1,
    damage = 1,
    scoreValue = 10,
    colour = '#39ff14',
    type = 'enemy'
  } = {}) {
    super({ x, y, radius, speed, colour, type });
    this.maxHealth = Math.max(1, Number(health));
    this.health = this.maxHealth;
    this.damage = Math.max(1, Number(damage));
    this.scoreValue = Math.max(0, Number(scoreValue));
    this.animationTime = 0;
    this.wobblePhase = Math.random() * Math.PI * 2;
  }

  /**
   * Executes pursuit AI navigation towards target coordinates.
   * Normalises direction vector to prevent diagonal velocity boosts,
   * updates orientation angle, and advances position.
   *
   * @param {number} targetX - Target horizontal coordinate (e.g. player.x).
   * @param {number} targetY - Target vertical coordinate (e.g. player.y).
   * @param {number} deltaTime - Elapsed frame time in seconds.
   */
  pursue(targetX, targetY, deltaTime) {
    if (!this.isAlive || deltaTime <= 0) {
      return;
    }

    this.animationTime += deltaTime;

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance === 0) {
      this.vx = 0;
      this.vy = 0;
      return;
    }

    this.angle = Math.atan2(dy, dx);
    const dirX = dx / distance;
    const dirY = dy / distance;

    this.vx = dirX * this.speed;
    this.vy = dirY * this.speed;

    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
  }

  /**
   * Applies damage to enemy, reducing health and marking defeat.
   *
   * @param {number} [amount=1] - Amount of damage taken.
   * @returns {boolean} True if enemy was defeated by this blow.
   */
  takeDamage(amount = 1) {
    if (!this.isAlive) return false;
    this.health -= Math.max(1, Number(amount));
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      return true;
    }
    return false;
  }

  /**
   * Tests circular collision against another entity.
   *
   * @param {Entity} other - Target entity to test overlap against.
   * @returns {boolean} True if hitboxes overlap.
   */
  checkCollision(other) {
    if (!this.isAlive || !other || !other.isAlive) {
      return false;
    }
    const dist = calculateDistance(this.x, this.y, other.x, other.y);
    return dist < (this.radius + other.radius);
  }

  /**
   * Renders the base enemy entity.
   *
   * @param {CanvasRenderingContext2D} ctx - Target 2D rendering context.
   */
  render(ctx) {
    if (!this.isAlive || !ctx) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Glowing orb silhouette
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.colour;
    ctx.shadowColor = this.colour;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.closePath();

    // Sinister glowing eyes
    ctx.beginPath();
    ctx.arc(this.radius * 0.4, -this.radius * 0.3, this.radius * 0.2, 0, Math.PI * 2);
    ctx.arc(this.radius * 0.4, this.radius * 0.3, this.radius * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ff0033';
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.closePath();

    ctx.restore();
  }
}

/**
 * Ghost entity: Swift, agile spectral stalker with ethereal lateral wobble.
 */
export class Ghost extends Enemy {
  /**
   * Initialises the Ghost archetype.
   *
   * @param {Object} [options={}] - Ghost parameters.
   */
  constructor(options = {}) {
    super({
      radius: 14,
      speed: 130,
      health: 1,
      damage: 1,
      scoreValue: 15,
      colour: 'rgba(57, 255, 20, 0.85)',
      type: 'ghost',
      ...options
    });
  }

  /**
   * Pursues player with subtle sinusoidal lateral wobble simulating floating flight.
   *
   * @param {number} targetX - Target horizontal position.
   * @param {number} targetY - Target vertical position.
   * @param {number} deltaTime - Frame elapsed time in seconds.
   */
  pursue(targetX, targetY, deltaTime) {
    if (!this.isAlive || deltaTime <= 0) return;

    this.animationTime += deltaTime;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance === 0) {
      this.vx = 0;
      this.vy = 0;
      return;
    }

    this.angle = Math.atan2(dy, dx);
    const dirX = dx / distance;
    const dirY = dy / distance;

    // Lateral wobble perpendicular to direct path
    const perpX = -dirY;
    const perpY = dirX;
    const wobbleSpeed = Math.sin(this.animationTime * 5 + this.wobblePhase) * 35;

    this.vx = dirX * this.speed + perpX * wobbleSpeed;
    this.vy = dirY * this.speed + perpY * wobbleSpeed;

    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
  }

  /**
   * Renders the ghost with floating ethereal tendrils and translucent aura.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas rendering context.
   */
  render(ctx) {
    if (!this.isAlive || !ctx) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Ethereal translucent body
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.colour;
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.closePath();

    // Spectral tail trail
    const tailWiggle = Math.sin(this.animationTime * 8) * (this.radius * 0.3);
    ctx.beginPath();
    ctx.moveTo(0, -this.radius * 0.7);
    ctx.lineTo(-this.radius * 1.5, tailWiggle);
    ctx.lineTo(0, this.radius * 0.7);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.fill();
    ctx.closePath();

    // Glowing cyan phantom eyes
    ctx.beginPath();
    ctx.arc(this.radius * 0.3, -this.radius * 0.25, this.radius * 0.18, 0, Math.PI * 2);
    ctx.arc(this.radius * 0.3, this.radius * 0.25, this.radius * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.closePath();

    ctx.restore();
  }
}

/**
 * Zombie entity: Relentless direct pursuer with necrotic aesthetic.
 */
export class Zombie extends Enemy {
  /**
   * Initialises the Zombie archetype.
   *
   * @param {Object} [options={}] - Zombie parameters.
   */
  constructor(options = {}) {
    super({
      radius: 16,
      speed: 80,
      health: 1,
      damage: 1,
      scoreValue: 10,
      colour: '#66bb6a',
      type: 'zombie',
      ...options
    });
  }

  /**
   * Renders zombie with rotting flesh green tone and forward-reaching arms.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas rendering context.
   */
  render(ctx) {
    if (!this.isAlive || !ctx) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Zombie torso & head
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.colour;
    ctx.shadowColor = '#2e7d32';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1b5e20';
    ctx.stroke();
    ctx.closePath();

    // Reaching grasping arms
    const armReach = this.radius * 1.2;
    ctx.beginPath();
    ctx.moveTo(this.radius * 0.2, -this.radius * 0.6);
    ctx.lineTo(armReach, -this.radius * 0.4);
    ctx.moveTo(this.radius * 0.2, this.radius * 0.6);
    ctx.lineTo(armReach, this.radius * 0.4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#388e3c';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.closePath();

    // Burning blood-red eyes
    ctx.beginPath();
    ctx.arc(this.radius * 0.4, -this.radius * 0.3, this.radius * 0.2, 0, Math.PI * 2);
    ctx.arc(this.radius * 0.4, this.radius * 0.3, this.radius * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ff1744';
    ctx.shadowColor = '#d50000';
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.closePath();

    ctx.restore();
  }
}

/**
 * PumpkinBrute entity: Massive armored demon requiring multiple shots to fell.
 */
export class PumpkinBrute extends Enemy {
  /**
   * Initialises the Pumpkin Brute archetype.
   *
   * @param {Object} [options={}] - Brute parameters.
   */
  constructor(options = {}) {
    super({
      radius: 24,
      speed: 55,
      health: 2,
      damage: 2,
      scoreValue: 30,
      colour: '#ff5722',
      type: 'brute',
      ...options
    });
  }

  /**
   * Renders the pumpkin brute with sinister jack-o'-lantern carved face and molten core.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas rendering context.
   */
  render(ctx) {
    if (!this.isAlive || !ctx) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Heavy pumpkin body
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.health > 1 ? this.colour : '#e64a19';
    ctx.shadowColor = '#ff3d00';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#bf360c';
    ctx.stroke();
    ctx.closePath();

    // Carved triangular glowing eyes
    const eyeSize = this.radius * 0.28;
    ctx.fillStyle = '#ffeb3b';
    ctx.shadowColor = '#ffeb3b';
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.moveTo(this.radius * 0.5, -this.radius * 0.35);
    ctx.lineTo(this.radius * 0.2, -this.radius * 0.55);
    ctx.lineTo(this.radius * 0.2, -this.radius * 0.15);
    ctx.fill();
    ctx.closePath();

    ctx.beginPath();
    ctx.moveTo(this.radius * 0.5, this.radius * 0.35);
    ctx.lineTo(this.radius * 0.2, this.radius * 0.15);
    ctx.lineTo(this.radius * 0.2, this.radius * 0.55);
    ctx.fill();
    ctx.closePath();

    // Jagged jack-o'-lantern mouth
    ctx.beginPath();
    ctx.moveTo(this.radius * 0.45, -this.radius * 0.3);
    ctx.lineTo(this.radius * 0.65, 0);
    ctx.lineTo(this.radius * 0.45, this.radius * 0.3);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#fff59d';
    ctx.stroke();
    ctx.closePath();

    ctx.restore();
  }
}

/**
 * Extensible Entity Factory providing centralised creation of game objects.
 * Encapsulates instantiations and enables seamless additions (foes, projectiles, items).
 */
export class EntityFactory {
  /**
   * Internal entity type constructors registry.
   * @type {Map<string, Function>}
   */
  static #registry = new Map([
    ['player', Player],
    ['projectile', Projectile],
    ['entity', Entity],
    ['enemy', Enemy],
    ['ghost', Ghost],
    ['zombie', Zombie],
    ['brute', PumpkinBrute],
    ['pumpkinbrute', PumpkinBrute]
  ]);

  /**
   * Registers a new entity class constructor into the factory.
   *
   * @param {string} type - Identifier name of the entity type.
   * @param {Function} constructorFn - Class constructor.
   */
  static register(type, constructorFn) {
    if (typeof type !== 'string' || !type.trim()) {
      throw new TypeError('[EntityFactory] Entity type must be a non-empty string.');
    }
    if (typeof constructorFn !== 'function') {
      throw new TypeError('[EntityFactory] Constructor must be a valid function/class.');
    }
    this.#registry.set(type.toLowerCase(), constructorFn);
  }

  /**
   * Instantiates an entity of the specified type.
   *
   * @param {string} type - Registered entity type name.
   * @param {Object} [options={}] - Construction options.
   * @returns {Entity} Instantiated entity.
   */
  static create(type, options = {}) {
    const key = (type || '').toLowerCase();
    const ConstructorClass = this.#registry.get(key);

    if (!ConstructorClass) {
      throw new Error(`[EntityFactory] Unknown entity type: "${type}".`);
    }

    return new ConstructorClass(options);
  }

  /**
   * Convenience factory method for creating a Player entity.
   *
   * @param {Object} [options={}] - Player configuration options.
   * @returns {Player} Created player instance.
   */
  static createPlayer(options = {}) {
    return this.create('player', options);
  }

  /**
   * Convenience factory method for creating a Projectile entity.
   *
   * @param {Object} [options={}] - Projectile configuration options.
   * @returns {Projectile} Created projectile instance.
   */
  static createProjectile(options = {}) {
    return this.create('projectile', options);
  }

  /**
   * Convenience factory method for creating an Enemy entity.
   *
   * @param {string} [type='zombie'] - Specific enemy archetype ('ghost', 'zombie', 'brute').
   * @param {Object} [options={}] - Configuration parameters.
   * @returns {Enemy} Created enemy instance.
   */
  static createEnemy(type = 'zombie', options = {}) {
    return this.create(type, options);
  }

  /**
   * Convenience factory method for creating a Ghost enemy.
   *
   * @param {Object} [options={}] - Ghost parameters.
   * @returns {Ghost} Created ghost instance.
   */
  static createGhost(options = {}) {
    return this.create('ghost', options);
  }

  /**
   * Convenience factory method for creating a Zombie enemy.
   *
   * @param {Object} [options={}] - Zombie parameters.
   * @returns {Zombie} Created zombie instance.
   */
  static createZombie(options = {}) {
    return this.create('zombie', options);
  }

  /**
   * Convenience factory method for creating a PumpkinBrute enemy.
   *
   * @param {Object} [options={}] - Brute parameters.
   * @returns {PumpkinBrute} Created brute instance.
   */
  static createBrute(options = {}) {
    return this.create('brute', options);
  }

  /**
   * Returns list of currently registered entity types.
   *
   * @returns {string[]} Registered types.
   */
  static getRegisteredTypes() {
    return Array.from(this.#registry.keys());
  }
}
