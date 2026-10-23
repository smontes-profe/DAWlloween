/**
 * @file gameView.js
 * @description Game View component managing the Canvas arena DOM and Heads-Up Display (HUD).
 * Provides responsive canvas mount, live HUD updates (timer, ammo cylinder, audio toggle),
 * and hooks the active webcam stream to a background video element for reaction capture.
 * Standards: UK English (en-GB), Zero local persistence.
 */

import { cameraService } from '../screamer/camera.js';
import { eventBus } from '../utils/eventBus.js';

/**
 * Game View component orchestrating the Canvas arena and HUD overlay.
 */
export class GameView {
  /**
   * Initialise the game view state.
   */
  constructor() {
    /** @type {HTMLElement|null} */
    this.rootElement = null;
    /** @type {HTMLCanvasElement|null} */
    this.canvas = null;
    /** @type {HTMLVideoElement|null} */
    this.videoElement = null;
    /** @type {HTMLElement|null} */
    this.timerDigits = null;
    /** @type {HTMLElement|null} */
    this.timerContainer = null;
    /** @type {HTMLElement|null} */
    this.ammoCylinder = null;
    /** @type {HTMLElement|null} */
    this.ammoLabel = null;
    /** @type {HTMLButtonElement|null} */
    this.audioToggleBtn = null;
    /** @type {HTMLButtonElement|null} */
    this.retreatBtn = null;

    /** @type {boolean} */
    this.isMuted = false;
    /** @type {Function|null} */
    this.boundAudioToggle = null;
    /** @type {Function|null} */
    this.boundRetreat = null;
  }

  /**
   * Mount the game arena and HUD elements into the SPA container.
   *
   * @param {HTMLElement} container - Target SPA host element (#app).
   */
  mount(container) {
    if (!container) {
      return;
    }

    const viewWrapper = document.createElement('div');
    viewWrapper.className = 'game-view';

    const arenaWrapper = document.createElement('div');
    arenaWrapper.className = 'game-arena-wrapper';

    // 1. HTML5 Canvas element
    const canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
    // Native logical coordinate space
    canvas.width = 1280;
    canvas.height = 720;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'DAWlloween 2D Survival Game Arena');
    arenaWrapper.appendChild(canvas);

    // 2. Hidden background video element for webcam frame ingestion
    const video = document.createElement('video');
    video.id = 'camera-stream-preview';
    video.className = 'camera-stream-hidden';
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    arenaWrapper.appendChild(video);

    // Automatically bind active camera stream if available
    if (cameraService && cameraService.isStreamActive()) {
      cameraService.attachVideoElement(video);
    }

    // 3. Heads-Up Display (HUD)
    const hud = document.createElement('div');
    hud.className = 'game-hud';

    // Top HUD Bar: Timer & Actions
    const hudTop = document.createElement('div');
    hudTop.className = 'game-hud__top';

    const timerContainer = document.createElement('div');
    timerContainer.className = 'hud-timer';
    timerContainer.setAttribute('role', 'timer');
    timerContainer.setAttribute('aria-label', 'Survival Time Remaining');

    const timerIcon = document.createElement('span');
    timerIcon.className = 'hud-timer__icon';
    timerIcon.setAttribute('aria-hidden', 'true');
    timerIcon.textContent = '⏱️';

    const timerDigits = document.createElement('span');
    timerDigits.className = 'hud-timer__digits';
    timerDigits.textContent = '00:60';

    timerContainer.appendChild(timerIcon);
    timerContainer.appendChild(timerDigits);
    hudTop.appendChild(timerContainer);

    const hudActions = document.createElement('div');
    hudActions.className = 'hud-actions';

    const audioToggleBtn = document.createElement('button');
    audioToggleBtn.id = 'btn-audio-toggle';
    audioToggleBtn.type = 'button';
    audioToggleBtn.className = 'hud-btn';
    audioToggleBtn.setAttribute('aria-label', 'Toggle audio mute');
    audioToggleBtn.innerHTML = '<span aria-hidden="true">🔊</span> Audio';

    const retreatBtn = document.createElement('button');
    retreatBtn.id = 'btn-retreat';
    retreatBtn.type = 'button';
    retreatBtn.className = 'hud-btn';
    retreatBtn.setAttribute('aria-label', 'Exit to home');
    retreatBtn.innerHTML = '<span aria-hidden="true">🚪</span> Retreat';

    hudActions.appendChild(audioToggleBtn);
    hudActions.appendChild(retreatBtn);
    hudTop.appendChild(hudActions);
    hud.appendChild(hudTop);

    // Bottom HUD Bar: Ammo cylinder & Status
    const hudBottom = document.createElement('div');
    hudBottom.className = 'game-hud__bottom';

    const ammoBox = document.createElement('div');
    ammoBox.className = 'hud-ammo';
    ammoBox.setAttribute('aria-label', 'Ammunition status');

    const ammoCylinder = document.createElement('div');
    ammoCylinder.className = 'hud-ammo__cylinder';

    // Build 6 bullet slots
    for (let i = 0; i < 6; i += 1) {
      const bullet = document.createElement('span');
      bullet.className = 'hud-bullet';
      bullet.setAttribute('aria-hidden', 'true');
      ammoCylinder.appendChild(bullet);
    }

    const ammoLabel = document.createElement('span');
    ammoLabel.className = 'hud-ammo__label';
    ammoLabel.textContent = '6 / 6';

    ammoBox.appendChild(ammoCylinder);
    ammoBox.appendChild(ammoLabel);
    hudBottom.appendChild(ammoBox);
    hud.appendChild(hudBottom);

    arenaWrapper.appendChild(hud);
    viewWrapper.appendChild(arenaWrapper);
    container.appendChild(viewWrapper);

    // Event listeners
    this.boundAudioToggle = () => this.handleAudioToggle();
    audioToggleBtn.addEventListener('click', this.boundAudioToggle);

    this.boundRetreat = () => {
      if (typeof window !== 'undefined') {
        window.location.hash = '#home';
      }
    };
    retreatBtn.addEventListener('click', this.boundRetreat);

    // Store references
    this.rootElement = viewWrapper;
    this.canvas = canvas;
    this.videoElement = video;
    this.timerContainer = timerContainer;
    this.timerDigits = timerDigits;
    this.ammoCylinder = ammoCylinder;
    this.ammoLabel = ammoLabel;
    this.audioToggleBtn = audioToggleBtn;
    this.retreatBtn = retreatBtn;
  }

  /**
   * Update the survival timer display on the HUD.
   *
   * @param {number} remainingSeconds - Total remaining seconds.
   */
  updateTimer(remainingSeconds) {
    if (!this.timerDigits) {
      return;
    }

    const safeSeconds = Math.max(0, Math.floor(remainingSeconds));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    this.timerDigits.textContent = formatted;

    // Apply urgent warning styles for final 10 seconds
    if (this.timerContainer) {
      if (safeSeconds <= 10 && safeSeconds > 0) {
        this.timerContainer.classList.add('hud-timer--urgent');
      } else {
        this.timerContainer.classList.remove('hud-timer--urgent');
      }
    }
  }

  /**
   * Update the ammunition cylinder indicator on the HUD.
   *
   * @param {number} currentRounds - Available bullets in current cylinder.
   * @param {number} [maxRounds=6] - Total cylinder capacity.
   * @param {boolean} [isReloading=false] - Whether reloading cooldown is active.
   */
  updateAmmo(currentRounds, maxRounds = 6, isReloading = false) {
    if (!this.ammoCylinder || !this.ammoLabel) {
      return;
    }

    const bullets = this.ammoCylinder.querySelectorAll('.hud-bullet');
    bullets.forEach((bullet, index) => {
      if (index < currentRounds) {
        bullet.classList.remove('hud-bullet--spent');
      } else {
        bullet.classList.add('hud-bullet--spent');
      }
    });

    if (isReloading) {
      this.ammoLabel.textContent = 'RELOADING...';
      this.ammoLabel.classList.add('hud-ammo__label--reloading');
    } else {
      this.ammoLabel.textContent = `${currentRounds} / ${maxRounds}`;
      this.ammoLabel.classList.remove('hud-ammo__label--reloading');
    }
  }

  /**
   * Handle audio mute button toggle.
   */
  handleAudioToggle() {
    this.isMuted = !this.isMuted;
    if (this.audioToggleBtn) {
      const icon = this.isMuted ? '🔇' : '🔊';
      const label = this.isMuted ? 'Muted' : 'Audio';
      this.audioToggleBtn.innerHTML = `<span aria-hidden="true">${icon}</span> ${label}`;
    }

    if (eventBus && typeof eventBus.publish === 'function') {
      eventBus.publish('audio:toggle-mute', { isMuted: this.isMuted });
    }
  }

  /**
   * Retrieve the active Canvas element.
   *
   * @returns {HTMLCanvasElement|null} The arena canvas.
   */
  getCanvas() {
    return this.canvas;
  }

  /**
   * Retrieve the video element associated with the camera stream.
   *
   * @returns {HTMLVideoElement|null}
   */
  getVideoElement() {
    return this.videoElement;
  }

  /**
   * Clean up event listeners and DOM elements upon view unmount.
   */
  unmount() {
    if (this.audioToggleBtn && this.boundAudioToggle) {
      this.audioToggleBtn.removeEventListener('click', this.boundAudioToggle);
      this.boundAudioToggle = null;
    }

    if (this.retreatBtn && this.boundRetreat) {
      this.retreatBtn.removeEventListener('click', this.boundRetreat);
      this.boundRetreat = null;
    }

    if (this.rootElement && this.rootElement.parentNode) {
      this.rootElement.parentNode.removeChild(this.rootElement);
    }

    this.rootElement = null;
    this.canvas = null;
    this.videoElement = null;
    this.timerDigits = null;
    this.timerContainer = null;
    this.ammoCylinder = null;
    this.ammoLabel = null;
    this.audioToggleBtn = null;
    this.retreatBtn = null;
  }
}

/**
 * Singleton instance of GameView for SPA usage.
 */
export const gameView = new GameView();

export default gameView;
