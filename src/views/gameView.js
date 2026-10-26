/**
 * @file gameView.js
 * @description Game View component managing the Canvas arena DOM and Heads-Up Display (HUD).
 * Provides responsive canvas mount, live HUD updates (timer, ammo cylinder, audio toggle),
 * and hooks the active webcam stream to a background video element for reaction capture.
 * Standards: UK English (en-GB), Zero local persistence.
 */

import { cameraService } from '../screamer/camera.js';
import { captureService } from '../screamer/capture.js';
import { recorderService } from '../screamer/recorder.js';
import { eventBus } from '../utils/eventBus.js';
import { GameEngine } from '../game/engine.js';
import { audioService } from '../services/audio.js';
import { ScreamerView, screamerView } from './screamerView.js';
import { SCREAMER_CONFIG } from '../config.js';

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
    /** @type {GameEngine|null} */
    this.engine = null;
    /** @type {HTMLVideoElement|null} */
    this.videoElement = null;
    /** @type {HTMLElement|null} */
    this.timerDigits = null;
    /** @type {HTMLElement|null} */
    this.timerContainer = null;
    /** @type {HTMLElement|null} */
    this.timerIcon = null;
    /** @type {HTMLElement|null} */
    this.ammoCylinder = null;
    /** @type {HTMLElement|null} */
    this.ammoLabel = null;
    /** @type {HTMLElement|null} */
    this.healthBox = null;
    /** @type {HTMLElement|null} */
    this.healthTokens = null;
    /** @type {HTMLElement|null} */
    this.healthLabel = null;
    /** @type {HTMLElement|null} */
    this.statsCluster = null;
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
    /** @type {Function|null} */
    this.boundUserGesture = null;
    /** @type {Function|null} */
    this.unsubscribeAmmo = null;
    /** @type {HTMLElement|null} */
    this.reloadWarning = null;
    /** @type {Function|null} */
    this.unsubscribeReloadStart = null;
    /** @type {Function|null} */
    this.unsubscribeMute = null;
    /** @type {Function|null} */
    this.unsubscribeTimer = null;
    /** @type {Function|null} */
    this.unsubscribeHealth = null;
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

    // Top HUD Bar: Left Stats Cluster (Health & Ammo) & Right Actions
    const hudTop = document.createElement('div');
    hudTop.className = 'game-hud__top';

    // Stats Cluster (Top-Left): Health Meter & Ammo Cylinder
    const statsCluster = document.createElement('div');
    statsCluster.className = 'game-hud__stats';

    // Player Health Meter (5 Discrete Gothic Tokens - US6.2 / T4)
    const healthBox = document.createElement('div');
    healthBox.className = 'hud-health';
    healthBox.setAttribute('role', 'status');
    healthBox.setAttribute('aria-label', 'Salud del jugador: 5 de 5 PV');

    const healthTokens = document.createElement('div');
    healthTokens.className = 'hud-health__tokens';

    // Build 5 gothic skull tokens
    for (let i = 0; i < 5; i += 1) {
      const token = document.createElement('span');
      token.className = 'hud-token';
      token.setAttribute('aria-hidden', 'true');
      token.textContent = '💀';
      healthTokens.appendChild(token);
    }

    const healthLabel = document.createElement('span');
    healthLabel.className = 'hud-health__label';
    healthLabel.textContent = '5 / 5';

    healthBox.appendChild(healthTokens);
    healthBox.appendChild(healthLabel);

    // Ammunition Box
    const ammoBox = document.createElement('div');
    ammoBox.className = 'hud-ammo';
    ammoBox.setAttribute('aria-label', 'Estado de munición');

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

    statsCluster.appendChild(healthBox);
    statsCluster.appendChild(ammoBox);
    hudTop.appendChild(statsCluster);

    // Hidden Countdown Timer (Suppressed visually to preserve surprise jumpscare factor)
    const timerContainer = document.createElement('div');
    timerContainer.className = 'hud-timer';
    timerContainer.setAttribute('role', 'timer');
    timerContainer.setAttribute('aria-live', 'polite');
    timerContainer.setAttribute('aria-label', 'Tiempo de supervivencia restante: 00:05');

    const timerIcon = document.createElement('span');
    timerIcon.className = 'hud-timer__icon';
    timerIcon.setAttribute('aria-hidden', 'true');
    timerIcon.textContent = '⏱️';

    const timerDigits = document.createElement('span');
    timerDigits.className = 'hud-timer__digits';
    timerDigits.textContent = '00:05';

    timerContainer.appendChild(timerIcon);
    timerContainer.appendChild(timerDigits);
    hudTop.appendChild(timerContainer);

    // Synchronise initial mute state with audioService
    this.isMuted = audioService && typeof audioService.isMuted === 'function' ? audioService.isMuted() : false;

    const hudActions = document.createElement('div');
    hudActions.className = 'hud-actions';

    const audioToggleBtn = document.createElement('button');
    audioToggleBtn.id = 'btn-audio-toggle';
    audioToggleBtn.type = 'button';
    audioToggleBtn.className = 'hud-btn';
    if (this.isMuted) {
      audioToggleBtn.classList.add('hud-btn--muted');
    }
    audioToggleBtn.setAttribute('aria-pressed', this.isMuted ? 'true' : 'false');
    audioToggleBtn.setAttribute(
      'aria-label',
      this.isMuted ? 'Activar audio (silenciado)' : 'Silenciar audio (activo)'
    );
    const audioIcon = this.isMuted ? '🔇' : '🔊';
    const audioLabel = this.isMuted ? 'Silenciado' : 'Sonido';
    audioToggleBtn.innerHTML = `<span aria-hidden="true">${audioIcon}</span> <span class="hud-btn__text">${audioLabel}</span>`;

    const retreatBtn = document.createElement('button');
    retreatBtn.id = 'btn-retreat';
    retreatBtn.type = 'button';
    retreatBtn.className = 'hud-btn';
    retreatBtn.setAttribute('aria-label', 'Salir al inicio');
    retreatBtn.innerHTML = '<span aria-hidden="true">🚪</span> Salir';

    hudActions.appendChild(audioToggleBtn);
    hudActions.appendChild(retreatBtn);
    hudTop.appendChild(hudActions);
    hud.appendChild(hudTop);
    arenaWrapper.appendChild(hud);

    // Prominent High-Contrast Flashing Reload Warning (US6.3 / T6)
    const reloadWarning = document.createElement('div');
    reloadWarning.id = 'hud-reload-warning';
    reloadWarning.className = 'hud-reload-warning';
    reloadWarning.setAttribute('role', 'alert');
    reloadWarning.setAttribute('aria-live', 'assertive');
    reloadWarning.setAttribute('aria-hidden', 'true');
    reloadWarning.textContent = '¡Recarga! (pulsar espacio)';
    arenaWrapper.appendChild(reloadWarning);

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
    this.healthBox = healthBox;
    this.healthTokens = healthTokens;
    this.healthLabel = healthLabel;
    this.statsCluster = statsCluster;
    this.timerContainer = timerContainer;
    this.timerDigits = timerDigits;
    this.timerIcon = timerIcon;
    this.ammoCylinder = ammoCylinder;
    this.ammoLabel = ammoLabel;
    this.audioToggleBtn = audioToggleBtn;
    this.reloadWarning = reloadWarning;
    this.retreatBtn = retreatBtn;

    // Initialise and start ambient sound track
    if (audioService && typeof audioService.initialise === 'function') {
      audioService.initialise();
      audioService.startAmbient();
    }

    // Defensive user-gesture unlock fallback for strict browser autoplay policies
    this.boundUserGesture = () => {
      if (audioService && typeof audioService.initialise === 'function') {
        audioService.initialise();
        audioService.startAmbient();
      }
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('click', this.boundUserGesture, { once: true });
      window.addEventListener('keydown', this.boundUserGesture, { once: true });
    }

    // Preload jumpscare video asset in background to eliminate buffering delays
    if (typeof ScreamerView.preload === 'function') {
      ScreamerView.preload();
    }

    // Initialise and boot Canvas 2D Game Engine (5 seconds survival timer for agile testing)
    this.engine = new GameEngine({ canvas, survivalDuration: SCREAMER_CONFIG.timeForScare });
    this.engine.start();

    // Subscribe to EventBus updates
    if (eventBus && typeof eventBus.subscribe === 'function') {
      this.unsubscribeAmmo = eventBus.subscribe('game:ammo-updated', (data) => {
        if (data) {
          this.updateAmmo(data.currentRounds, data.maxRounds, data.isReloading);
        }
      });

      this.unsubscribeReloadStart = eventBus.subscribe('game:weapon-reload-start', () => {
        if (this.reloadWarning) {
          this.reloadWarning.classList.remove('hud-reload-warning--visible');
          this.reloadWarning.setAttribute('aria-hidden', 'true');
        }
      });

      this.unsubscribeHealth = eventBus.subscribe('game:health-updated', (data) => {
        if (data) {
          const current = typeof data.current === 'number' ? data.current : data.health;
          const max = typeof data.max === 'number' ? data.max : (data.maxHealth || 5);
          if (typeof current === 'number') {
            this.updateHealth(current, max);
          }
        }
      });

      this.unsubscribeMute = eventBus.subscribe('audio:toggle-mute', (data) => {
        if (data && typeof data.isMuted === 'boolean') {
          this.syncAudioMuteUI(data.isMuted);
        }
      });

      this.unsubscribeTimer = eventBus.subscribe('game:timer-tick', (data) => {
        if (data && typeof data.remainingSeconds === 'number') {
          this.updateTimer(data.remainingSeconds);
        }
      });

      this.unsubscribeScreamer = eventBus.subscribe('game:trigger-screamer', () => {
        if (audioService && typeof audioService.stopAmbient === 'function') {
          audioService.stopAmbient();
        }
        // Jump the screamer directly over the active game screen without halting the game engine
        if (typeof document !== 'undefined' && document.body && screamerView && typeof screamerView.mountOverlay === 'function') {
          screamerView.mountOverlay(document.body);
        } else if (typeof window !== 'undefined' && window.location) {
          window.location.hash = '#screamer';
        }
      });
    }

    // Clear any stale snapshot and initialise video recording listener
    if (captureService && typeof captureService.clearSnapshot === 'function') {
      captureService.clearSnapshot();
    }
    if (recorderService && typeof recorderService.initialiseRecorderListener === 'function') {
      recorderService.initialiseRecorderListener();
    }
  }

  /**
   * Update the survival timer display on the HUD with progressive visual tension.
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

    if (this.timerContainer) {
      this.timerContainer.setAttribute('aria-label', `Tiempo de supervivencia restante: ${formatted}`);

      // Progressive visual tension styling:
      // Tier 3: Expired (0s): skull icon, crimson alert
      // Tier 2: Urgent (1s - 10s): red heartbeat pulse, flashing beacon icon
      // Tier 1: Warning (11s - 20s): pumpkin orange glow, hourglass icon
      // Normal (> 20s): calm stopwatch
      this.timerContainer.classList.remove('hud-timer--warning', 'hud-timer--urgent', 'hud-timer--expired');

      if (safeSeconds === 0) {
        this.timerContainer.classList.add('hud-timer--expired');
        if (this.timerIcon) this.timerIcon.textContent = '💀';
      } else if (safeSeconds <= 10) {
        this.timerContainer.classList.add('hud-timer--urgent');
        if (this.timerIcon) this.timerIcon.textContent = '🚨';
      } else if (safeSeconds <= 20) {
        this.timerContainer.classList.add('hud-timer--warning');
        if (this.timerIcon) this.timerIcon.textContent = '⏳';
      } else {
        if (this.timerIcon) this.timerIcon.textContent = '⏱️';
      }
    }
  }

  /**
   * Update the player health indicator on the HUD using 5 discrete gothic tokens.
   *
   * @param {number} currentHealth - Current player health value (0 to 5, or legacy percentage 0-100).
   * @param {number} [maxHealth=5] - Maximum possible health (defaults to 5 discrete HP).
   */
  updateHealth(currentHealth, maxHealth = 5) {
    if (!this.healthBox || !this.healthLabel) {
      return;
    }

    const safeMax = Math.max(1, Number(maxHealth) || 5);
    const safeCurrent = Math.max(0, Number(currentHealth) || 0);

    // Map percentage values (> 5) down to 0-5 scale defensively if legacy callers invoke with percentage
    const discreteMax = safeMax > 5 ? 5 : safeMax;
    const discreteCurrent = safeMax > 5
      ? Math.round((safeCurrent / safeMax) * 5)
      : Math.min(safeCurrent, discreteMax);

    const tokens = this.healthTokens
      ? this.healthTokens.querySelectorAll('.hud-token')
      : this.healthBox.querySelectorAll('.hud-token');

    tokens.forEach((token, index) => {
      if (index < discreteCurrent) {
        token.classList.remove('hud-token--empty');
      } else {
        token.classList.add('hud-token--empty');
      }
    });

    this.healthLabel.textContent = `${discreteCurrent} / ${discreteMax}`;

    this.healthBox.setAttribute(
      'aria-label',
      `Salud del jugador: ${discreteCurrent} de ${discreteMax} PV`
    );

    this.healthBox.classList.remove('hud-health--critical', 'hud-health--warning');
    if (discreteCurrent <= 1) {
      this.healthBox.classList.add('hud-health--critical');
    } else if (discreteCurrent <= 2) {
      this.healthBox.classList.add('hud-health--warning');
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
      this.ammoLabel.textContent = 'RECARGANDO...';
      this.ammoLabel.classList.add('hud-ammo__label--reloading');
    } else {
      this.ammoLabel.textContent = `${currentRounds} / ${maxRounds}`;
      this.ammoLabel.classList.remove('hud-ammo__label--reloading');
    }

    // Toggle prominent high-contrast flashing reload prompt (US6.3 / T6)
    if (this.reloadWarning) {
      if (currentRounds === 0 && !isReloading) {
        this.reloadWarning.classList.add('hud-reload-warning--visible');
        this.reloadWarning.setAttribute('aria-hidden', 'false');
      } else {
        this.reloadWarning.classList.remove('hud-reload-warning--visible');
        this.reloadWarning.setAttribute('aria-hidden', 'true');
      }
    }
  }

  /**
   * Handle audio mute button toggle.
   */
  handleAudioToggle() {
    if (audioService && typeof audioService.toggleMute === 'function') {
      this.isMuted = audioService.toggleMute();
    } else {
      this.isMuted = !this.isMuted;
    }

    this.syncAudioMuteUI(this.isMuted);

    if (eventBus && typeof eventBus.publish === 'function') {
      eventBus.publish('audio:toggle-mute', { isMuted: this.isMuted });
    }
  }

  /**
   * Synchronise audio HUD toggle button UI state and accessibility attributes.
   *
   * @param {boolean} isMuted - Whether audio is muted.
   */
  syncAudioMuteUI(isMuted) {
    this.isMuted = Boolean(isMuted);
    if (!this.audioToggleBtn) {
      return;
    }

    this.audioToggleBtn.setAttribute('aria-pressed', this.isMuted ? 'true' : 'false');
    this.audioToggleBtn.setAttribute(
      'aria-label',
      this.isMuted ? 'Activar audio (silenciado)' : 'Silenciar audio (activo)'
    );

    if (this.isMuted) {
      this.audioToggleBtn.classList.add('hud-btn--muted');
    } else {
      this.audioToggleBtn.classList.remove('hud-btn--muted');
    }

    const icon = this.isMuted ? '🔇' : '🔊';
    const label = this.isMuted ? 'Silenciado' : 'Sonido';
    this.audioToggleBtn.innerHTML = `<span aria-hidden="true">${icon}</span> <span class="hud-btn__text">${label}</span>`;
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
   * Retrieve the active GameEngine instance.
   *
   * @returns {GameEngine|null}
   */
  getEngine() {
    return this.engine;
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
    // Cease ambient sound playback
    if (audioService && typeof audioService.stopAmbient === 'function') {
      audioService.stopAmbient();
    }

    if (typeof this.unsubscribeAmmo === 'function') {
      this.unsubscribeAmmo();
      this.unsubscribeAmmo = null;
    }

    if (typeof this.unsubscribeReloadStart === 'function') {
      this.unsubscribeReloadStart();
      this.unsubscribeReloadStart = null;
    }

    if (typeof this.unsubscribeHealth === 'function') {
      this.unsubscribeHealth();
      this.unsubscribeHealth = null;
    }

    if (typeof this.unsubscribeMute === 'function') {
      this.unsubscribeMute();
      this.unsubscribeMute = null;
    }

    if (typeof this.unsubscribeTimer === 'function') {
      this.unsubscribeTimer();
      this.unsubscribeTimer = null;
    }

    if (typeof this.unsubscribeScreamer === 'function') {
      this.unsubscribeScreamer();
      this.unsubscribeScreamer = null;
    }

    if (captureService && typeof captureService.detachCaptureListener === 'function') {
      captureService.detachCaptureListener();
    }
    if (recorderService && typeof recorderService.detachRecorderListener === 'function') {
      recorderService.detachRecorderListener();
    }

    if (this.boundUserGesture && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('click', this.boundUserGesture);
      window.removeEventListener('keydown', this.boundUserGesture);
      this.boundUserGesture = null;
    }

    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }

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
    this.timerIcon = null;
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
