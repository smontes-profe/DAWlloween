/**
 * @file gameView.test.js
 * @description Unit tests for GameView component.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameView } from '../src/views/gameView.js';
import { cameraService } from '../src/screamer/camera.js';
import { eventBus } from '../src/utils/eventBus.js';
import { audioService } from '../src/services/audio.js';

/**
 * Lightweight mock DOM environment for GameView testing.
 */
function createMockDom() {
  class MockElement {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.id = '';
      this.className = '';
      this.width = 0;
      this.height = 0;
      this.style = {};
      this.attributes = new Map();
      this.childNodes = [];
      this.parentNode = null;
      this.textContent = '';
      this.innerHTML = '';
      this.listeners = new Map();
      this.classList = {
        _classes: new Set(),
        add: (...c) => c.forEach((cls) => this.classList._classes.add(cls)),
        remove: (...c) => c.forEach((cls) => this.classList._classes.delete(cls)),
        contains: (cls) => this.classList._classes.has(cls)
      };
    }

    setAttribute(k, v) {
      this.attributes.set(k, String(v));
    }

    getAttribute(k) {
      return this.attributes.get(k) || null;
    }

    removeAttribute(k) {
      this.attributes.delete(k);
    }

    appendChild(child) {
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }

    removeChild(child) {
      const idx = this.childNodes.indexOf(child);
      if (idx !== -1) {
        this.childNodes.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    }

    addEventListener(evt, fn) {
      if (!this.listeners.has(evt)) this.listeners.set(evt, []);
      this.listeners.get(evt).push(fn);
    }

    removeEventListener(evt, fn) {
      if (this.listeners.has(evt)) {
        const arr = this.listeners.get(evt);
        const idx = arr.indexOf(fn);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }

    querySelectorAll(selector) {
      const results = [];
      this._findMatching(selector, results);
      return results;
    }

    querySelector(selector) {
      const list = this.querySelectorAll(selector);
      return list.length > 0 ? list[0] : null;
    }

    _findMatching(selector, accumulator) {
      for (const child of this.childNodes) {
        let matches = false;
        if (selector.startsWith('#') && child.id === selector.slice(1)) matches = true;
        if (selector.startsWith('.') && (child.className.includes(selector.slice(1)) || child.classList.contains(selector.slice(1)))) matches = true;
        if (matches) accumulator.push(child);
        if (typeof child._findMatching === 'function') {
          child._findMatching(selector, accumulator);
        }
      }
    }
  }

  const container = new MockElement('MAIN');
  container.id = 'app';

  const doc = {
    createElement: (tag) => new MockElement(tag)
  };

  const win = {
    location: { hash: '#play' }
  };

  return { doc, win, container };
}

describe('GameView Unit Tests', () => {
  let mockEnv;
  let originalDocument;
  let originalWindow;

  beforeEach(() => {
    mockEnv = createMockDom();
    originalDocument = globalThis.document;
    originalWindow = globalThis.window;
    globalThis.document = mockEnv.doc;
    globalThis.window = mockEnv.win;
    eventBus.clear();
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    eventBus.clear();
    if (audioService) {
      audioService.setMuted(false);
      audioService.stopAmbient();
    }
  });

  it('should render canvas with 1280x720 logical coordinates, hidden video, and HUD', () => {
    const view = new GameView();
    view.mount(mockEnv.container);

    const canvas = view.getCanvas();
    assert.ok(canvas);
    assert.equal(canvas.id, 'game-canvas');
    assert.equal(canvas.width, 1280);
    assert.equal(canvas.height, 720);

    const video = view.getVideoElement();
    assert.ok(video);
    assert.equal(video.id, 'camera-stream-preview');

    assert.ok(mockEnv.container.querySelector('.game-hud'), 'HUD overlay should be appended inside container');
    assert.ok(mockEnv.container.querySelector('.game-hud__top'), 'Top HUD bar should be appended inside HUD');
    assert.ok(mockEnv.container.querySelector('.hud-health'), 'Health indicator should be in mounted container DOM');
    assert.ok(mockEnv.container.querySelector('.hud-ammo'), 'Ammo cylinder should be in mounted container DOM');

    assert.ok(view.statsCluster, 'Stats cluster container should exist');
    assert.equal(view.statsCluster.className, 'game-hud__stats');

    assert.ok(view.healthBox, 'Health box container should exist in stats cluster');
    assert.equal(view.healthLabel.textContent, '5 / 5');
    const initialHealthTokens = view.healthBox.querySelectorAll('.hud-token');
    assert.equal(initialHealthTokens.length, 5, 'Should mount 5 discrete gothic tokens');

    assert.ok(view.timerDigits);
    assert.equal(view.timerDigits.textContent, '00:05');
    assert.ok(view.timerContainer);
    assert.ok(view.timerContainer.className.includes('hud-timer'));

    assert.ok(view.ammoCylinder);
    const bullets = view.ammoCylinder.querySelectorAll('.hud-bullet');
    assert.equal(bullets.length, 6);
  });

  it('should render 5 discrete gothic tokens and update display upon health events (US6.2 / T4)', () => {
    const view = new GameView();
    view.mount(mockEnv.container);

    const tokens = view.healthBox.querySelectorAll('.hud-token');
    assert.equal(tokens.length, 5, 'Initial DOM should contain 5 health tokens');

    // Initial state: 5 / 5
    assert.equal(view.healthLabel.textContent, '5 / 5');
    assert.equal(view.healthBox.getAttribute('aria-label'), 'Salud del jugador: 5 de 5 PV');
    tokens.forEach((t) => assert.equal(t.classList.contains('hud-token--empty'), false));

    // Update to 4 PV (1 empty token)
    view.updateHealth(4, 5);
    assert.equal(view.healthLabel.textContent, '4 / 5');
    assert.equal(tokens[0].classList.contains('hud-token--empty'), false);
    assert.equal(tokens[3].classList.contains('hud-token--empty'), false);
    assert.equal(tokens[4].classList.contains('hud-token--empty'), true);
    assert.equal(view.healthBox.classList.contains('hud-health--warning'), false);
    assert.equal(view.healthBox.classList.contains('hud-health--critical'), false);

    // Update to 2 PV (warning tier)
    view.updateHealth(2, 5);
    assert.equal(view.healthLabel.textContent, '2 / 5');
    assert.equal(tokens[1].classList.contains('hud-token--empty'), false);
    assert.equal(tokens[2].classList.contains('hud-token--empty'), true);
    assert.equal(view.healthBox.classList.contains('hud-health--warning'), true);
    assert.equal(view.healthBox.classList.contains('hud-health--critical'), false);

    // Update to 1 PV (critical tier) via EventBus
    eventBus.publish('game:health-updated', { current: 1, max: 5 });
    assert.equal(view.healthLabel.textContent, '1 / 5');
    assert.equal(tokens[0].classList.contains('hud-token--empty'), false);
    assert.equal(tokens[1].classList.contains('hud-token--empty'), true);
    assert.equal(view.healthBox.classList.contains('hud-health--critical'), true);

    // Update to 0 PV (all empty) via EventBus with legacy payload shape
    eventBus.publish('game:health-updated', { health: 0, maxHealth: 5 });
    assert.equal(view.healthLabel.textContent, '0 / 5');
    tokens.forEach((t) => assert.equal(t.classList.contains('hud-token--empty'), true));
    assert.equal(view.healthBox.classList.contains('hud-health--critical'), true);
  });

  it('should format countdown timer with progressive visual tension tiers (normal, warning, urgent, expired)', () => {
    const view = new GameView();
    view.mount(mockEnv.container);

    // 1. Normal state (45 seconds): no tension classes, stopwatch icon
    view.updateTimer(45);
    assert.equal(view.timerDigits.textContent, '00:45');
    assert.equal(view.timerContainer.classList.contains('hud-timer--warning'), false);
    assert.equal(view.timerContainer.classList.contains('hud-timer--urgent'), false);
    assert.equal(view.timerContainer.classList.contains('hud-timer--expired'), false);
    assert.equal(view.timerIcon.textContent, '⏱️');

    // 2. Warning state (15 seconds): warning class, hourglass icon
    view.updateTimer(15);
    assert.equal(view.timerDigits.textContent, '00:15');
    assert.equal(view.timerContainer.classList.contains('hud-timer--warning'), true);
    assert.equal(view.timerContainer.classList.contains('hud-timer--urgent'), false);
    assert.equal(view.timerContainer.classList.contains('hud-timer--expired'), false);
    assert.equal(view.timerIcon.textContent, '⏳');

    // 3. Urgent state (8 seconds): urgent class, beacon icon
    view.updateTimer(8);
    assert.equal(view.timerDigits.textContent, '00:08');
    assert.equal(view.timerContainer.classList.contains('hud-timer--warning'), false);
    assert.equal(view.timerContainer.classList.contains('hud-timer--urgent'), true);
    assert.equal(view.timerContainer.classList.contains('hud-timer--expired'), false);
    assert.equal(view.timerIcon.textContent, '🚨');

    // 4. Expired state (0 seconds): expired class, skull icon
    view.updateTimer(0);
    assert.equal(view.timerDigits.textContent, '00:00');
    assert.equal(view.timerContainer.classList.contains('hud-timer--warning'), false);
    assert.equal(view.timerContainer.classList.contains('hud-timer--urgent'), false);
    assert.equal(view.timerContainer.classList.contains('hud-timer--expired'), true);
    assert.equal(view.timerIcon.textContent, '💀');

    // 5. Reactive EventBus update on game:timer-tick
    eventBus.publish('game:timer-tick', { remainingSeconds: 18 });
    assert.equal(view.timerDigits.textContent, '00:18');
    assert.equal(view.timerContainer.classList.contains('hud-timer--warning'), true);
  });

  it('should update ammo cylinder and reloading indicator', () => {
    const view = new GameView();
    view.mount(mockEnv.container);

    // 4 rounds remaining out of 6
    view.updateAmmo(4, 6, false);
    assert.equal(view.ammoLabel.textContent, '4 / 6');
    assert.equal(view.ammoLabel.classList.contains('hud-ammo__label--reloading'), false);

    const bullets = view.ammoCylinder.querySelectorAll('.hud-bullet');
    // First 4 bullets active, last 2 spent
    assert.equal(bullets[0].classList.contains('hud-bullet--spent'), false);
    assert.equal(bullets[3].classList.contains('hud-bullet--spent'), false);
    assert.equal(bullets[4].classList.contains('hud-bullet--spent'), true);
    assert.equal(bullets[5].classList.contains('hud-bullet--spent'), true);

    // Reloading active
    view.updateAmmo(0, 6, true);
    assert.equal(view.ammoLabel.textContent, 'RECARGANDO...');
    assert.equal(view.ammoLabel.classList.contains('hud-ammo__label--reloading'), true);
  });

  it('should toggle prominent flashing reload warning when ammunition reaches 0 and dismiss on reload (US6.3 / T6)', () => {
    const view = new GameView();
    view.mount(mockEnv.container);

    assert.ok(view.reloadWarning, 'Reload warning element should exist in DOM');
    assert.equal(view.reloadWarning.textContent, '¡Recarga! (pulsar espacio)');
    assert.equal(view.reloadWarning.classList.contains('hud-reload-warning--visible'), false);
    assert.equal(view.reloadWarning.getAttribute('aria-hidden'), 'true');

    // Ammunition partially depleted (3 rounds): warning should remain hidden
    view.updateAmmo(3, 6, false);
    assert.equal(view.reloadWarning.classList.contains('hud-reload-warning--visible'), false);

    // Ammunition completely empty (0 rounds, not reloading yet): warning should become visible
    view.updateAmmo(0, 6, false);
    assert.equal(view.reloadWarning.classList.contains('hud-reload-warning--visible'), true);
    assert.equal(view.reloadWarning.getAttribute('aria-hidden'), 'false');

    // Manual reload initiated via method call: warning must dismiss immediately
    view.updateAmmo(0, 6, true);
    assert.equal(view.reloadWarning.classList.contains('hud-reload-warning--visible'), false);
    assert.equal(view.reloadWarning.getAttribute('aria-hidden'), 'true');

    // Empty again: warning becomes visible
    view.updateAmmo(0, 6, false);
    assert.equal(view.reloadWarning.classList.contains('hud-reload-warning--visible'), true);

    // Manual reload initiated via EventBus game:weapon-reload-start: warning must dismiss immediately
    eventBus.publish('game:weapon-reload-start', { currentRounds: 0, maxRounds: 6 });
    assert.equal(view.reloadWarning.classList.contains('hud-reload-warning--visible'), false);
    assert.equal(view.reloadWarning.getAttribute('aria-hidden'), 'true');

    // Replenished to full (6 rounds): warning stays hidden
    view.updateAmmo(6, 6, false);
    assert.equal(view.reloadWarning.classList.contains('hud-reload-warning--visible'), false);
  });

  it('should toggle audio mute with accessible attributes and publish audio:toggle-mute event', () => {
    const view = new GameView();
    view.mount(mockEnv.container);

    assert.ok(view.audioToggleBtn);
    assert.equal(view.audioToggleBtn.getAttribute('aria-pressed'), 'false');
    assert.equal(view.audioToggleBtn.getAttribute('aria-label'), 'Silenciar audio (activo)');
    assert.equal(view.audioToggleBtn.classList.contains('hud-btn--muted'), false);

    const audioEvents = [];
    eventBus.subscribe('audio:toggle-mute', (data) => audioEvents.push(data));

    view.handleAudioToggle();
    assert.equal(view.isMuted, true);
    assert.equal(view.audioToggleBtn.getAttribute('aria-pressed'), 'true');
    assert.equal(view.audioToggleBtn.getAttribute('aria-label'), 'Activar audio (silenciado)');
    assert.equal(view.audioToggleBtn.classList.contains('hud-btn--muted'), true);
    assert.equal(audioEvents.length, 1);
    assert.deepEqual(audioEvents[0], { isMuted: true });

    view.handleAudioToggle();
    assert.equal(view.isMuted, false);
    assert.equal(view.audioToggleBtn.getAttribute('aria-pressed'), 'false');
    assert.equal(view.audioToggleBtn.getAttribute('aria-label'), 'Silenciar audio (activo)');
    assert.equal(view.audioToggleBtn.classList.contains('hud-btn--muted'), false);
    assert.equal(audioEvents.length, 2);
    assert.deepEqual(audioEvents[1], { isMuted: false });
  });

  it('should reactively update HUD audio button upon external audio:toggle-mute events', () => {
    const view = new GameView();
    view.mount(mockEnv.container);

    assert.equal(view.isMuted, false);

    // External mute published
    eventBus.publish('audio:toggle-mute', { isMuted: true });
    assert.equal(view.isMuted, true);
    assert.equal(view.audioToggleBtn.getAttribute('aria-pressed'), 'true');
    assert.equal(view.audioToggleBtn.classList.contains('hud-btn--muted'), true);

    // External unmute published
    eventBus.publish('audio:toggle-mute', { isMuted: false });
    assert.equal(view.isMuted, false);
    assert.equal(view.audioToggleBtn.getAttribute('aria-pressed'), 'false');
    assert.equal(view.audioToggleBtn.classList.contains('hud-btn--muted'), false);
  });

  it('should start ambient music on mount and cease playback on unmount', () => {
    let ambientStarted = false;
    let ambientStopped = false;

    const originalStart = audioService.startAmbient;
    const originalStop = audioService.stopAmbient;

    audioService.startAmbient = () => {
      ambientStarted = true;
    };
    audioService.stopAmbient = () => {
      ambientStopped = true;
    };

    try {
      const view = new GameView();
      view.mount(mockEnv.container);
      assert.equal(ambientStarted, true);

      view.unmount();
      assert.equal(ambientStopped, true);
    } finally {
      audioService.startAmbient = originalStart;
      audioService.stopAmbient = originalStop;
    }
  });

  it('should attach active camera stream to hidden video on mount', () => {
    let attachedVideo = null;
    const originalIsActive = cameraService.isStreamActive;
    const originalAttach = cameraService.attachVideoElement;

    cameraService.isStreamActive = () => true;
    cameraService.attachVideoElement = (v) => {
      attachedVideo = v;
    };

    try {
      const view = new GameView();
      view.mount(mockEnv.container);

      assert.ok(attachedVideo);
      assert.equal(attachedVideo.id, 'camera-stream-preview');
    } finally {
      cameraService.isStreamActive = originalIsActive;
      cameraService.attachVideoElement = originalAttach;
    }
  });

  it('should cease ambient playback and transition to #screamer when game:trigger-screamer event is published', () => {
    let ambientStopped = false;
    const originalStop = audioService.stopAmbient;
    audioService.stopAmbient = () => {
      ambientStopped = true;
    };

    try {
      const view = new GameView();
      view.mount(mockEnv.container);

      eventBus.publish('game:trigger-screamer', { reason: 'timer_expired' });
      assert.equal(ambientStopped, true);
      assert.equal(mockEnv.win.location.hash, '#screamer');

      view.unmount();
    } finally {
      audioService.stopAmbient = originalStop;
    }
  });

  it('should cleanly unmount and clear references', () => {
    const view = new GameView();
    view.mount(mockEnv.container);
    assert.equal(mockEnv.container.childNodes.length, 1);

    view.unmount();
    assert.equal(mockEnv.container.childNodes.length, 0);
    assert.equal(view.canvas, null);
    assert.equal(view.rootElement, null);
  });
});
