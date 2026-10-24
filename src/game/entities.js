/**
 * @file entities.js
 * @description Base entity classes, Player entity, and extensible Entity Factory
 * for the DAWlloween 2D Canvas survival arena game.
 * Design Patterns: Factory Pattern, Inheritance / Polymorphic Entities.
 * Language Standards: UK English (en-GB).
 */

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
    /** Player health or hit points */
    this.health = options.health ?? 100;
    this.maxHealth = options.maxHealth ?? 100;
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
    ['entity', Entity]
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
   * Returns list of currently registered entity types.
   *
   * @returns {string[]} Registered types.
   */
  static getRegisteredTypes() {
    return Array.from(this.#registry.keys());
  }
}
