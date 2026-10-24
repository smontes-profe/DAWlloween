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
    assert.strictEqual(player.health, 100);
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
});

describe('EntityFactory Unit Tests', () => {
  it('should create a Player entity using createPlayer convenience method', () => {
    const player = EntityFactory.createPlayer({ x: 150, y: 250 });
    assert.ok(player instanceof Player);
    assert.strictEqual(player.x, 150);
    assert.strictEqual(player.y, 250);
    assert.strictEqual(player.type, 'player');
  });

  it('should create registered entity types via create()', () => {
    const entity = EntityFactory.create('entity', { x: 50, y: 50 });
    assert.ok(entity instanceof Entity);
    assert.strictEqual(entity.type, 'entity');

    const player = EntityFactory.create('PLAYER', { speed: 300 });
    assert.ok(player instanceof Player);
    assert.strictEqual(player.speed, 300);
  });

  it('should throw an informative error when creating an unknown entity type', () => {
    assert.throws(
      () => EntityFactory.create('vampire'),
      /\[EntityFactory\] Unknown entity type: "vampire"/
    );
  });

  it('should support registering custom entity constructors dynamically', () => {
    class GhostEntity extends Entity {
      constructor(opts = {}) {
        super({ type: 'ghost', colour: '#e0e0e0', ...opts });
        this.spectralPhase = true;
      }
    }

    EntityFactory.register('ghost', GhostEntity);

    assert.ok(EntityFactory.getRegisteredTypes().includes('ghost'));
    const ghost = EntityFactory.create('ghost', { x: 99, y: 88 });
    assert.ok(ghost instanceof GhostEntity);
    assert.strictEqual(ghost.type, 'ghost');
    assert.strictEqual(ghost.spectralPhase, true);
  });

  it('should validate arguments during registration', () => {
    assert.throws(() => EntityFactory.register('', () => {}), TypeError);
    assert.throws(() => EntityFactory.register('zombie', null), TypeError);
  });
});
