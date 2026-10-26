/**
 * @file entities.test.js
 * @description Unit tests for game entities, vector maths, Player logic, and EntityFactory.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseVector,
  calculateDistance,
  calculateAngle,
  Entity,
  Player,
  Projectile,
  Enemy,
  Ghost,
  Zombie,
  PumpkinBrute,
  EntityFactory
} from '../src/game/entities.js';

/**
 * Creates a lightweight mock 2D canvas context to verify render operations.
 *
 * @returns {Object} Mock CanvasRenderingContext2D.
 */
function createMockCanvasContext() {
  const operations = [];
  return {
    operations,
    save: () => operations.push('save'),
    restore: () => operations.push('restore'),
    translate: (x, y) => operations.push(`translate(${x},${y})`),
    rotate: (angle) => operations.push(`rotate(${angle})`),
    beginPath: () => operations.push('beginPath'),
    closePath: () => operations.push('closePath'),
    arc: (x, y, r, sa, ea) => operations.push(`arc(${x},${y},${r},${sa},${ea})`),
    rect: (x, y, w, h) => operations.push(`rect(${x},${y},${w},${h})`),
    moveTo: (x, y) => operations.push(`moveTo(${x},${y})`),
    lineTo: (x, y) => operations.push(`lineTo(${x},${y})`),
    fill: () => operations.push('fill'),
    stroke: () => operations.push('stroke'),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    createRadialGradient: () => ({
      addColorStop: () => {}
    })
  };
}

describe('Vector & Mathematical Utilities Unit Tests', () => {
  it('should normalise a zero vector without producing NaN or Infinity', () => {
    const result = normaliseVector(0, 0);
    assert.strictEqual(result.x, 0);
    assert.strictEqual(result.y, 0);
    assert.strictEqual(result.magnitude, 0);
  });

  it('should preserve unit magnitude for cardinal vectors', () => {
    const right = normaliseVector(10, 0);
    assert.strictEqual(right.x, 1);
    assert.strictEqual(right.y, 0);
    assert.strictEqual(right.magnitude, 10);

    const up = normaliseVector(0, -5);
    assert.strictEqual(up.x, 0);
    assert.strictEqual(up.y, -1);
    assert.strictEqual(up.magnitude, 5);
  });

  it('should correctly normalise diagonal vectors to eliminate diagonal speed advantage', () => {
    const diagonal = normaliseVector(1, 1);
    const expectedComp = 1 / Math.SQRT2;
    assert.ok(Math.abs(diagonal.x - expectedComp) < 1e-6);
    assert.ok(Math.abs(diagonal.y - expectedComp) < 1e-6);
    assert.ok(Math.abs(diagonal.magnitude - Math.SQRT2) < 1e-6);
  });

  it('should calculate accurate Euclidean distance', () => {
    const dist = calculateDistance(0, 0, 3, 4);
    assert.strictEqual(dist, 5);
  });

  it('should calculate accurate orientation angles in radians', () => {
    // East / Right (angle = 0)
    assert.strictEqual(calculateAngle(0, 0, 10, 0), 0);
    // South / Down in screen coords (angle = PI / 2)
    assert.strictEqual(calculateAngle(0, 0, 0, 10), Math.PI / 2);
    // West / Left (angle = PI)
    assert.strictEqual(calculateAngle(0, 0, -10, 0), Math.PI);
    // North / Up in screen coords (angle = -PI / 2)
    assert.strictEqual(calculateAngle(0, 0, 0, -10), -Math.PI / 2);
  });
});

describe('Entity Base Class Unit Tests', () => {
  it('should initialise with default properties and UK English standards', () => {
    const entity = new Entity();
    assert.strictEqual(entity.x, 0);
    assert.strictEqual(entity.y, 0);
    assert.strictEqual(entity.radius, 16);
    assert.strictEqual(entity.speed, 200);
    assert.strictEqual(entity.colour, '#ff7518');
    assert.strictEqual(entity.type, 'entity');
    assert.strictEqual(entity.isAlive, true);
  });

  it('should accept custom initialisation parameters', () => {
    const entity = new Entity({
      x: 100,
      y: 200,
      radius: 25,
      speed: 350,
      colour: '#39ff14',
      type: 'ghost'
    });
    assert.strictEqual(entity.x, 100);
    assert.strictEqual(entity.y, 200);
    assert.strictEqual(entity.radius, 25);
    assert.strictEqual(entity.speed, 350);
    assert.strictEqual(entity.colour, '#39ff14');
    assert.strictEqual(entity.type, 'ghost');
  });

  it('should update position according to velocity and deltaTime', () => {
    const entity = new Entity({ x: 50, y: 50 });
    entity.vx = 100;
    entity.vy = -50;
    entity.update(0.5); // 0.5 seconds elapsed

    assert.strictEqual(entity.x, 100);
    assert.strictEqual(entity.y, 25);
  });

  it('should not update position if entity is not alive', () => {
    const entity = new Entity({ x: 50, y: 50 });
    entity.vx = 100;
    entity.isAlive = false;
    entity.update(1.0);

    assert.strictEqual(entity.x, 50);
  });

  it('should clamp position strictly within arena bounds considering radius', () => {
    const entity = new Entity({ x: -50, y: -50, radius: 20 });
    const arenaWidth = 800;
    const arenaHeight = 600;

    // Entity is outside top-left boundary
    entity.clampToBounds(arenaWidth, arenaHeight);
    assert.strictEqual(entity.x, 20);
    assert.strictEqual(entity.y, 20);

    // Entity is outside bottom-right boundary
    entity.x = 900;
    entity.y = 700;
    entity.clampToBounds(arenaWidth, arenaHeight);
    assert.strictEqual(entity.x, 780);
    assert.strictEqual(entity.y, 580);
  });

  it('should detect collisions with other circular entities accurately', () => {
    const entityA = new Entity({ x: 100, y: 100, radius: 20 });
    const entityB = new Entity({ x: 130, y: 100, radius: 15 }); // Distance is 30, radii sum is 35 -> Collision
    const entityC = new Entity({ x: 200, y: 100, radius: 15 }); // Distance is 100 -> No collision

    assert.strictEqual(entityA.collidesWith(entityB), true);
    assert.strictEqual(entityA.collidesWith(entityC), false);

    // Collision should be false if either entity is dead
    entityB.isAlive = false;
    assert.strictEqual(entityA.collidesWith(entityB), false);
  });
});

describe('Player Entity Unit Tests', () => {
  it('should construct player with default attributes and Halloween theme tokens', () => {
    const player = new Player({ x: 400, y: 300 });
    assert.strictEqual(player.x, 400);
    assert.strictEqual(player.y, 300);
    assert.strictEqual(player.radius, 18);
    assert.strictEqual(player.speed, 240);
    assert.strictEqual(player.colour, '#ff7518');
    assert.strictEqual(player.glowColour, '#39ff14');
    assert.strictEqual(player.type, 'player');
    assert.strictEqual(player.health, 5);
  });

  it('should adjust orientation angle towards target coordinate with lookAt', () => {
    const player = new Player({ x: 100, y: 100 });
    player.lookAt(100, 200); // Looking directly downward
    assert.strictEqual(player.angle, Math.PI / 2);

    player.lookAt(200, 100); // Looking directly to the right
    assert.strictEqual(player.angle, 0);
  });

  it('should move cardinally at full speed without distortion', () => {
    const player = new Player({ x: 100, y: 100, speed: 200 });
    // Move East / Right (+X)
    player.move(1.0, { moveX: 1, moveY: 0 });
    assert.strictEqual(player.x, 300);
    assert.strictEqual(player.y, 100);
  });

  it('should move diagonally with normalised velocity', () => {
    const player = new Player({ x: 0, y: 0, speed: 100 });
    // Move North-East (+X, -Y) for 1 second
    player.move(1.0, { moveX: 1, moveY: -1 });

    const expectedDelta = 100 / Math.SQRT2;
    assert.ok(Math.abs(player.x - expectedDelta) < 1e-6);
    assert.ok(Math.abs(player.y - (-expectedDelta)) < 1e-6);
  });

  it('should remain stationary when movement input vector is zero', () => {
    const player = new Player({ x: 50, y: 50 });
    player.move(1.0, { moveX: 0, moveY: 0 });
    assert.strictEqual(player.x, 50);
    assert.strictEqual(player.y, 50);
    assert.strictEqual(player.vx, 0);
    assert.strictEqual(player.vy, 0);
  });

  it('should clamp player within arena boundaries while moving', () => {
    const bounds = { width: 500, height: 400 };
    const player = new Player({ x: 20, y: 20, radius: 18, speed: 500 });

    // Move left and up towards out of bounds
    player.move(1.0, { moveX: -1, moveY: -1 }, bounds);
    assert.strictEqual(player.x, 18);
    assert.strictEqual(player.y, 18);

    // Teleport close to bottom-right and move outward
    player.x = 490;
    player.y = 390;
    player.move(1.0, { moveX: 1, moveY: 1 }, bounds);
    assert.strictEqual(player.x, 500 - 18);
    assert.strictEqual(player.y, 400 - 18);
  });

  it('should render player and directional flashlight without throwing on valid context', () => {
    const player = new Player({ x: 120, y: 80, angle: Math.PI / 4 });
    const mockCtx = createMockCanvasContext();

    assert.doesNotThrow(() => {
      player.render(mockCtx);
    });

    assert.ok(mockCtx.operations.includes('save'));
    assert.ok(mockCtx.operations.includes('translate(120,80)'));
    assert.ok(mockCtx.operations.includes(`rotate(${Math.PI / 4})`));
    assert.ok(mockCtx.operations.includes('fill'));
    assert.ok(mockCtx.operations.includes('restore'));
  });

  it('should apply damage and mark player as dead when health reaches zero', () => {
    const player = new Player({ health: 100 });
    assert.strictEqual(player.health, 100);
    assert.strictEqual(player.isAlive, true);

    const defeated1 = player.takeDamage(40);
    assert.strictEqual(player.health, 60);
    assert.strictEqual(player.isAlive, true);
    assert.strictEqual(defeated1, false);

    const defeated2 = player.takeDamage(80);
    assert.strictEqual(player.health, 0);
    assert.strictEqual(player.isAlive, false);
    assert.strictEqual(defeated2, true);

    // Further damage when already dead should return false and keep health at 0
    const defeated3 = player.takeDamage(10);
    assert.strictEqual(player.health, 0);
    assert.strictEqual(defeated3, false);
  });
});

describe('Projectile Entity Unit Tests', () => {
  it('should initialise projectile with ballistic velocity based on angle', () => {
    // Firing directly to the right (angle = 0)
    const pRight = new Projectile({ x: 100, y: 100, angle: 0, speed: 800 });
    assert.strictEqual(pRight.vx, 800);
    assert.strictEqual(pRight.vy, 0);
    assert.strictEqual(pRight.type, 'projectile');
    assert.strictEqual(pRight.radius, 4);
    assert.strictEqual(pRight.damage, 25);
    assert.strictEqual(pRight.isAlive, true);

    // Firing directly downwards (angle = PI / 2)
    const pDown = new Projectile({ x: 100, y: 100, angle: Math.PI / 2, speed: 600 });
    assert.ok(Math.abs(pDown.vx) < 1e-6);
    assert.ok(Math.abs(pDown.vy - 600) < 1e-6);
  });

  it('should advance linearly and record recent positions in trail', () => {
    const projectile = new Projectile({ x: 50, y: 50, angle: 0, speed: 500 });
    projectile.update(0.1); // Advances 50px

    assert.strictEqual(projectile.x, 100);
    assert.strictEqual(projectile.y, 50);
    assert.strictEqual(projectile.trail.length, 1);
    assert.deepStrictEqual(projectile.trail[0], { x: 50, y: 50 });

    // Subsequent updates record trail capped at maxTrailLength
    projectile.update(0.1);
    projectile.update(0.1);
    projectile.update(0.1);
    projectile.update(0.1);
    assert.strictEqual(projectile.trail.length, 4);
  });

  it('should despawn (isAlive = false) when exiting arena boundaries', () => {
    const arenaBounds = { width: 1000, height: 600 };
    const projectile = new Projectile({ x: 990, y: 300, angle: 0, speed: 500 });

    // Within bounds
    projectile.update(0.01, arenaBounds);
    assert.strictEqual(projectile.isAlive, true);

    // Moves past right boundary (> 1000 + radius)
    projectile.update(0.1, arenaBounds);
    assert.strictEqual(projectile.isAlive, false);
  });

  it('should detect collisions with enemy circular entities', () => {
    const projectile = new Projectile({ x: 200, y: 200, radius: 4 });
    const enemy = new Entity({ x: 215, y: 200, radius: 15, type: 'enemy' });

    // Distance = 15, sum of radii = 19 -> Collision
    assert.strictEqual(projectile.collidesWith(enemy), true);

    // Move enemy far away
    enemy.x = 400;
    assert.strictEqual(projectile.collidesWith(enemy), false);
  });

  it('should render glowing core and ballistic trail without throwing', () => {
    const projectile = new Projectile({ x: 100, y: 100, angle: 0 });
    const mockCtx = createMockCanvasContext();

    projectile.update(0.05);
    assert.doesNotThrow(() => {
      projectile.render(mockCtx);
    });

    assert.ok(mockCtx.operations.includes('arc(137.5,100,4,0,6.283185307179586)'));
    assert.ok(mockCtx.operations.includes('fill'));
  });
});

describe('Enemy Entities & Pursuit AI Unit Tests (US1.6 / T15)', () => {
  it('should initialise base enemy with default attributes and full health', () => {
    const enemy = new Enemy({ x: 100, y: 150 });
    assert.strictEqual(enemy.x, 100);
    assert.strictEqual(enemy.y, 150);
    assert.strictEqual(enemy.radius, 16);
    assert.strictEqual(enemy.speed, 80);
    assert.strictEqual(enemy.health, 1);
    assert.strictEqual(enemy.maxHealth, 1);
    assert.strictEqual(enemy.damage, 1);
    assert.strictEqual(enemy.isAlive, true);
    assert.strictEqual(enemy.colour, '#39ff14');
  });

  it('should accurately calculate pursuit angle and advance towards target coordinates', () => {
    // Enemy at (0, 0), target at (100, 0) -> Moving East along X axis
    const enemy = new Enemy({ x: 0, y: 0, speed: 100 });
    enemy.pursue(100, 0, 0.5);

    assert.strictEqual(enemy.angle, 0);
    assert.strictEqual(enemy.vx, 100);
    assert.strictEqual(enemy.vy, 0);
    assert.strictEqual(enemy.x, 50); // 100 px/s * 0.5s = 50px
    assert.strictEqual(enemy.y, 0);

    // Enemy pursuing diagonally towards (50, 50)
    const diagEnemy = new Enemy({ x: 0, y: 0, speed: 100 });
    diagEnemy.pursue(50, 50, 1.0);
    const expectedComp = 100 / Math.SQRT2;
    assert.ok(Math.abs(diagEnemy.vx - expectedComp) < 1e-6);
    assert.ok(Math.abs(diagEnemy.vy - expectedComp) < 1e-6);
    assert.ok(Math.abs(diagEnemy.x - expectedComp) < 1e-6);
  });

  it('should safely handle zero-distance pursuit without producing NaN or zero-division', () => {
    const enemy = new Enemy({ x: 50, y: 50, speed: 120 });
    enemy.pursue(50, 50, 0.1);

    assert.strictEqual(enemy.vx, 0);
    assert.strictEqual(enemy.vy, 0);
    assert.strictEqual(enemy.x, 50);
    assert.strictEqual(enemy.y, 50);
    assert.strictEqual(Number.isNaN(enemy.x), false);
  });

  it('should ignore pursuit updates if enemy is already defeated or deltaTime is non-positive', () => {
    const enemy = new Enemy({ x: 10, y: 10, speed: 80 });
    enemy.isAlive = false;
    enemy.pursue(100, 100, 1.0);
    assert.strictEqual(enemy.x, 10);

    const liveEnemy = new Enemy({ x: 10, y: 10, speed: 80 });
    liveEnemy.pursue(100, 100, 0);
    assert.strictEqual(liveEnemy.x, 10);
  });

  it('should decrement health on damage and mark defeat when health reaches zero', () => {
    const enemy = new Enemy({ health: 2 });
    assert.strictEqual(enemy.health, 2);

    const defeatedFirst = enemy.takeDamage(1);
    assert.strictEqual(defeatedFirst, false);
    assert.strictEqual(enemy.health, 1);
    assert.strictEqual(enemy.isAlive, true);

    const defeatedSecond = enemy.takeDamage(1);
    assert.strictEqual(defeatedSecond, true);
    assert.strictEqual(enemy.health, 0);
    assert.strictEqual(enemy.isAlive, false);

    // Further damage on dead enemy returns false
    assert.strictEqual(enemy.takeDamage(1), false);
  });

  it('should detect circular collision with entities and ignore dead entities', () => {
    const enemy = new Enemy({ x: 100, y: 100, radius: 15 });
    const player = new Player({ x: 120, y: 100, radius: 15 });

    // Distance = 20, combined radius = 30 -> Collision
    assert.strictEqual(enemy.checkCollision(player), true);

    // Move player away
    player.x = 200;
    assert.strictEqual(enemy.checkCollision(player), false);

    // If player or enemy is dead, no collision
    player.x = 120;
    player.isAlive = false;
    assert.strictEqual(enemy.checkCollision(player), false);

    player.isAlive = true;
    enemy.isAlive = false;
    assert.strictEqual(enemy.checkCollision(player), false);
  });

  it('should initialise Ghost archetype with high speed, spectral colour, and lateral wobble', () => {
    const ghost = new Ghost({ x: 50, y: 50 });
    assert.strictEqual(ghost.type, 'ghost');
    assert.strictEqual(ghost.speed, 130);
    assert.strictEqual(ghost.health, 1);
    assert.strictEqual(ghost.radius, 14);
    assert.strictEqual(ghost.colour, 'rgba(57, 255, 20, 0.85)');

    // Pursuit introduces lateral wobble velocity component
    ghost.wobblePhase = 0;
    ghost.pursue(200, 50, 0.1);
    assert.notStrictEqual(ghost.vx, 0);
    assert.strictEqual(ghost.isAlive, true);

    const mockCtx = createMockCanvasContext();
    assert.doesNotThrow(() => ghost.render(mockCtx));
    assert.ok(mockCtx.operations.includes('beginPath'));
    assert.ok(mockCtx.operations.includes('fill'));
  });

  it('should initialise Zombie archetype with standard speed and render properly', () => {
    const zombie = new Zombie({ x: 80, y: 80 });
    assert.strictEqual(zombie.type, 'zombie');
    assert.strictEqual(zombie.speed, 80);
    assert.strictEqual(zombie.health, 1);
    assert.strictEqual(zombie.radius, 16);
    assert.strictEqual(zombie.colour, '#66bb6a');

    const mockCtx = createMockCanvasContext();
    assert.doesNotThrow(() => zombie.render(mockCtx));
    assert.ok(mockCtx.operations.includes('stroke'));
  });

  it('should initialise PumpkinBrute archetype with high health and handle multiple hits', () => {
    const brute = new PumpkinBrute({ x: 100, y: 100 });
    assert.strictEqual(brute.type, 'brute');
    assert.strictEqual(brute.speed, 55);
    assert.strictEqual(brute.health, 2);
    assert.strictEqual(brute.radius, 24);
    assert.strictEqual(brute.damage, 2);
    assert.strictEqual(brute.scoreValue, 30);

    // Survives 1 hit
    const firstHit = brute.takeDamage(1);
    assert.strictEqual(firstHit, false);
    assert.strictEqual(brute.isAlive, true);
    assert.strictEqual(brute.health, 1);

    // Felled by 2nd hit
    const secondHit = brute.takeDamage(1);
    assert.strictEqual(secondHit, true);
    assert.strictEqual(brute.isAlive, false);

    const mockCtx = createMockCanvasContext();
    brute.isAlive = true;
    assert.doesNotThrow(() => brute.render(mockCtx));
  });
});

describe('EntityFactory Unit Tests', () => {
  it('should create a Player entity using createPlayer convenience method', () => {
    const player = EntityFactory.createPlayer({ x: 150, y: 250 });
    assert.ok(player instanceof Player);
    assert.strictEqual(player.x, 150);
    assert.strictEqual(player.y, 250);
    assert.strictEqual(player.type, 'player');
  });

  it('should create a Projectile entity using createProjectile convenience method', () => {
    const projectile = EntityFactory.createProjectile({ x: 100, y: 80, angle: Math.PI / 4 });
    assert.ok(projectile instanceof Projectile);
    assert.strictEqual(projectile.x, 100);
    assert.strictEqual(projectile.y, 80);
    assert.strictEqual(projectile.type, 'projectile');
  });

  it('should create enemy archetypes via convenience factory methods', () => {
    const ghost = EntityFactory.createGhost({ x: 10, y: 20 });
    assert.ok(ghost instanceof Ghost);
    assert.strictEqual(ghost.type, 'ghost');

    const zombie = EntityFactory.createZombie({ x: 30, y: 40 });
    assert.ok(zombie instanceof Zombie);
    assert.strictEqual(zombie.type, 'zombie');

    const brute = EntityFactory.createBrute({ x: 50, y: 60 });
    assert.ok(brute instanceof PumpkinBrute);
    assert.strictEqual(brute.type, 'brute');

    const genericEnemy = EntityFactory.createEnemy('ghost', { x: 70, y: 80 });
    assert.ok(genericEnemy instanceof Ghost);
  });

  it('should create registered entity types via create()', () => {
    const entity = EntityFactory.create('entity', { x: 50, y: 50 });
    assert.ok(entity instanceof Entity);
    assert.strictEqual(entity.type, 'entity');

    const player = EntityFactory.create('PLAYER', { speed: 300 });
    assert.ok(player instanceof Player);
    assert.strictEqual(player.speed, 300);

    const zombie = EntityFactory.create('zombie');
    assert.ok(zombie instanceof Zombie);
  });

  it('should throw an informative error when creating an unknown entity type', () => {
    assert.throws(
      () => EntityFactory.create('vampire_lord'),
      /\[EntityFactory\] Unknown entity type: "vampire_lord"/
    );
  });

  it('should support registering custom entity constructors dynamically', () => {
    class CustomWraith extends Entity {
      constructor(opts = {}) {
        super({ type: 'wraith', colour: '#e0e0e0', ...opts });
        this.spectralPhase = true;
      }
    }

    EntityFactory.register('wraith', CustomWraith);

    assert.ok(EntityFactory.getRegisteredTypes().includes('wraith'));
    const wraith = EntityFactory.create('wraith', { x: 99, y: 88 });
    assert.ok(wraith instanceof CustomWraith);
    assert.strictEqual(wraith.type, 'wraith');
    assert.strictEqual(wraith.spectralPhase, true);
  });

  it('should validate arguments during registration', () => {
    assert.throws(() => EntityFactory.register('', () => {}), TypeError);
    assert.throws(() => EntityFactory.register('ghoul', null), TypeError);
  });
});
