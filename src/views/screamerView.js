/**
 * @file screamerView.js
 * @description Fullscreen Jumpscare view component for DAWlloween.
 * Features real-time Chroma Key (green-screen removal) video playback using HTML5 Canvas,
 * seamless transparent overlay right over the active gameplay screen,
 * native video audio scream, and automatic timed transition to #register.
 * Follows strict UK English (en-GB) and zero local persistence.
 */

import { eventBus } from '../utils/eventBus.js';
import { SCREAMER_CONFIG } from '../config.js';
import { recorderService } from '../screamer/recorder.js';

/**
 * Duration in milliseconds for jumpscare scare exposure before auto-transitioning to #register.
 * Sourced centrally from SCREAMER_CONFIG in src/config.js.
 * @constant {number}
 */
export const DEFAULT_SCREAMER_DURATION_MS = SCREAMER_CONFIG.durationMs;

/**
 * Emergency safety fallback duration in milliseconds.
 * Sourced centrally from SCREAMER_CONFIG in src/config.js.
 * @constant {number}
 */
export const DEFAULT_SAFETY_FALLBACK_TIMEOUT_MS = SCREAMER_CONFIG.safetyFallbackTimeoutMs;

/**
 * Buffering threshold in milliseconds before automatically engaging the SVG monster fallback.
 * Sourced centrally from SCREAMER_CONFIG in src/config.js.
 * @constant {number}
 */
export const BUFFERING_FALLBACK_THRESHOLD_MS = SCREAMER_CONFIG.bufferingFallbackThresholdMs;

/**
 * Default video path for the jumpscare video asset.
 * @constant {string}
 */
export const JUMPSCARE_VIDEO_PATH = './assets/jumpscare.mp4';

/**
 * ScreamerView component handling the climactic jumpscare shock sequence.
 */
export class ScreamerView {
  /**
   * Cached preloaded HTMLVideoElement reference.
   * @type {HTMLVideoElement|null}
   * @private
   */
  static _preloadedVideo = null;

  /**
   * Preloads the jumpscare video asset into the browser cache.
   * Can be safely called during WelcomeView or GameView mounting to avoid buffering latency.
   *
   * @returns {HTMLVideoElement|null} The preloaded video element.
   */
  static preload() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return null;
    }
    try {
      if (ScreamerView._preloadedVideo) {
        return ScreamerView._preloadedVideo;
      }
      const preloadedVideo = document.createElement('video');
      preloadedVideo.src = JUMPSCARE_VIDEO_PATH;
      preloadedVideo.preload = 'auto';
      preloadedVideo.muted = true;
      if (typeof preloadedVideo.setAttribute === 'function') {
        preloadedVideo.setAttribute('playsinline', '');
      }
      if (typeof preloadedVideo.load === 'function') {
        preloadedVideo.load();
      }
      ScreamerView._preloadedVideo = preloadedVideo;
      return preloadedVideo;
    } catch (err) {
      console.warn('[ScreamerView] Video preloading failed gracefully:', err);
      return null;
    }
  }

  /**
   * Initialises the ScreamerView instance.
   */
  constructor() {
    /** @type {HTMLElement|null} */
    this.container = null;

    /** @type {HTMLElement|null} */
    this.overlayHost = null;

    /** @type {HTMLVideoElement|null} */
    this.videoElement = null;

    /** @type {HTMLCanvasElement|null} */
    this.chromaCanvas = null;

    /** @type {CanvasRenderingContext2D|null} */
    this.chromaCtx = null;

    /** @type {number|null} */
    this.transitionTimeoutId = null;

    /** @type {number|null} */
    this.bufferingFallbackTimeoutId = null;

    /** @type {number|null} */
    this.animationFrameId = null;

    /** @type {boolean} */
    this.isTransitioning = false;

    /** @type {boolean} */
    this.isVideoActive = false;

    /** @type {boolean} */
    this.hasNotifiedPlaybackStart = false;

    /** @type {((event: KeyboardEvent) => void)|null} */
    this.boundKeyDownHandler = null;

    /** @type {((event: MouseEvent) => void)|null} */
    this.boundClickHandler = null;

    /** @type {(() => void)|null} */
    this.boundVideoEndedHandler = null;

    /** @type {(() => void)|null} */
    this.boundVideoPlayHandler = null;

    /** @type {(() => void)|null} */
    this.boundVideoErrorHandler = null;
  }

  /**
   * Mounts the jumpscare as a transparent overlay directly on top of an active view (e.g. game arena).
   *
   * @param {HTMLElement} [parent] - Target parent element (defaults to document.body).
   */
  mountOverlay(parent = (typeof document !== 'undefined' ? document.body : null)) {
    if (!parent || typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return;
    }
    this.unmount();
    const overlayWrapper = document.createElement('div');
    overlayWrapper.id = 'screamer-overlay-host';
    parent.appendChild(overlayWrapper);
    this.overlayHost = overlayWrapper;
    this.mount(overlayWrapper);
  }

  /**
   * Mounts the jumpscare view into the provided root container.
   *
   * @param {HTMLElement} container - The main container element.
   */
  mount(container) {
    this.container = container;
    this.isTransitioning = false;
    this.isVideoActive = false;
    this.hasNotifiedPlaybackStart = false;

    // Render transparent shock DOM structure over the active game view
    this.container.innerHTML = this.template();

    // Bind accessibility keyboard skip (Escape only; Space and Enter are explicitly
    // blocked to prevent accidental player shooting from skipping the scare)
    this.boundKeyDownHandler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.transitionToRegister();
      }
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('keydown', this.boundKeyDownHandler);
    }

    // Explicit skip button listener (accessible button only; entire screen clicks are
    // intentionally not bound to prevent weapon left-clicks from cutting the jumpscare short)
    const skipBtn = this.container.querySelector('.screamer-view__skip-btn');
    if (skipBtn) {
      this.boundClickHandler = (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        this.transitionToRegister();
      };
      skipBtn.addEventListener('click', this.boundClickHandler);
    }

    // Emergency safety fallback timer: ensures navigation to #register
    // occurs if video decoding or network completely stalls without triggering error
    this.transitionTimeoutId = window.setTimeout(() => {
      this.transitionToRegister();
    }, DEFAULT_SAFETY_FALLBACK_TIMEOUT_MS);

    // Initialise Chroma-Key video pipeline
    this.initialiseVideoChroma();
  }

  /**
   * Dispatches the decoupled screamer:playback-started event once the visual jumpscare
   * (video frame playback or fallback SVG) is genuinely visible on screen.
   * Starts the exact durationMs timer from this precise moment.
   *
   * @param {boolean} [isFallback=false] - Whether fallback SVG is active instead of video.
   */
  notifyPlaybackStarted(isFallback = false) {
    if (this.hasNotifiedPlaybackStart) {
      return;
    }
    this.hasNotifiedPlaybackStart = true;

    // Clear buffering guard timeout
    if (this.bufferingFallbackTimeoutId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.bufferingFallbackTimeoutId);
      this.bufferingFallbackTimeoutId = null;
    }

    // Reset transition timeout to durationMs starting from THIS exact visual moment
    if (this.transitionTimeoutId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.transitionTimeoutId);
      this.transitionTimeoutId = null;
    }

    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
      this.transitionTimeoutId = window.setTimeout(() => {
        this.transitionToRegister();
      }, DEFAULT_SCREAMER_DURATION_MS);
    }

    if (eventBus && typeof eventBus.publish === 'function') {
      eventBus.publish('screamer:playback-started', {
        durationMs: DEFAULT_SCREAMER_DURATION_MS,
        isFallback,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Initialises the HTML5 Video element and attaches real-time Chroma Key processing.
   */
  initialiseVideoChroma() {
    if (!this.container) {
      return;
    }

    this.videoElement = this.container.querySelector('.screamer-view__video');
    this.chromaCanvas = this.container.querySelector('#screamer-chroma-canvas');
    const monsterSvg = this.container.querySelector('.screamer-view__monster');

    if (!this.videoElement || !this.chromaCanvas || typeof this.chromaCanvas.getContext !== 'function') {
      return;
    }

    this.chromaCtx = this.chromaCanvas.getContext('2d');

    // Video ended handler: retain the horrifying climactic frame on the chroma canvas
    // over the running game until the exposure duration elapses
    this.boundVideoEndedHandler = () => {
      // Keep last frame rendered on canvas without cutting away abruptly
    };
    this.videoElement.addEventListener('ended', this.boundVideoEndedHandler);

    // Video error handler -> fallback to SVG animation
    this.boundVideoErrorHandler = () => {
      console.warn('[ScreamerView] Jumpscare video unavailable or decoding failed. Falling back to SVG animation.');
      if (monsterSvg) {
        monsterSvg.classList.remove('screamer-view__monster--hidden');
      }
      if (this.chromaCanvas) {
        this.chromaCanvas.style.display = 'none';
      }

      this.notifyPlaybackStarted(true);
    };
    this.videoElement.addEventListener('error', this.boundVideoErrorHandler);

    // Video play handler -> start real-time green screen removal loop and notify playback start
    this.boundVideoPlayHandler = () => {
      this.isVideoActive = true;
      if (monsterSvg) {
        monsterSvg.classList.add('screamer-view__monster--hidden');
      }
      if (this.chromaCanvas) {
        this.chromaCanvas.style.display = 'block';
      }

      this.notifyPlaybackStarted(false);
      this.startChromaLoop();
    };
    this.videoElement.addEventListener('play', this.boundVideoPlayHandler);
    this.videoElement.addEventListener('playing', this.boundVideoPlayHandler);

    // Buffering guard: if video does not begin playing within threshold, engage SVG fallback
    this.bufferingFallbackTimeoutId = window.setTimeout(() => {
      if (!this.isVideoActive) {
        console.warn('[ScreamerView] Video buffering exceeded threshold. Engaging SVG fallback.');
        if (this.boundVideoErrorHandler) {
          this.boundVideoErrorHandler();
        }
      }
    }, BUFFERING_FALLBACK_THRESHOLD_MS);

    // Configure audio & source
    this.videoElement.muted = false;
    this.videoElement.volume = 1.0;
    this.videoElement.loop = true;
    this.videoElement.src = JUMPSCARE_VIDEO_PATH;
    this.videoElement.load();

    const playPromise = this.videoElement.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('[ScreamerView] Unmuted video autoplay prevented by browser. Trying muted fallback:', err);
        // Fallback: if browser blocks unmuted autoplay, mute and play so visual still triggers
        if (this.videoElement) {
          this.videoElement.muted = true;
          this.videoElement.play().catch(() => {
            // If even muted play fails, engage SVG monster fallback
            if (this.boundVideoErrorHandler) {
              this.boundVideoErrorHandler();
            }
          });
        }
      });
    }
  }

  /**
   * Executes the real-time Chroma Key render loop on requestAnimationFrame.
   * Strips the green screen background pixels by setting their alpha channel to 0.
   */
  startChromaLoop() {
    const processFrame = () => {
      if (!this.isVideoActive || !this.videoElement || this.videoElement.paused || this.videoElement.ended) {
        return;
      }

      const video = this.videoElement;
      const canvas = this.chromaCanvas;
      const ctx = this.chromaCtx;

      if (video.videoWidth > 0 && video.videoHeight > 0 && canvas && ctx) {
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = frame.data;
          const len = data.length;

          // Real-time green-screen thresholding & feathering
          for (let i = 0; i < len; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Primary chroma key: high green relative to red & blue
            if (g > 85 && g > r * 1.25 && g > b * 1.25) {
              data[i + 3] = 0; // Transparent
            } else if (g > 70 && g > r * 1.1 && g > b * 1.1) {
              // Edge spill softening & anti-aliasing
              const diff = g - Math.max(r, b);
              data[i + 3] = Math.max(0, 255 - diff * 3.5);
            }
          }

          ctx.putImageData(frame, 0, 0);
        } catch (error) {
          console.warn('[ScreamerView] Canvas pixel manipulation exception:', error);
          this.isVideoActive = false;
          return;
        }
      }

      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        this.animationFrameId = window.requestAnimationFrame(processFrame);
      }
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      this.animationFrameId = window.requestAnimationFrame(processFrame);
    }
  }

  /**
   * Transitions navigation seamlessly from #screamer to #register after ensuring
   * the webcam reaction recording has stopped and is ready in memory.
   */
  async transitionToRegister() {
    if (this.isTransitioning) {
      return;
    }
    this.isTransitioning = true;
    this.isVideoActive = false;

    if (this.animationFrameId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.transitionTimeoutId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.transitionTimeoutId);
      this.transitionTimeoutId = null;
    }

    if (this.bufferingFallbackTimeoutId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.bufferingFallbackTimeoutId);
      this.bufferingFallbackTimeoutId = null;
    }

    if (this.videoElement) {
      try {
        this.videoElement.pause();
      } catch {
        // Safe ignore
      }
    }

    // Await recorder finalisation to guarantee the reaction video Blob is ready before mounting #register
    if (recorderService && typeof recorderService.stopRecordingAsync === 'function') {
      try {
        await recorderService.stopRecordingAsync();
      } catch (err) {
        console.warn('[ScreamerView] Exception while stopping reaction recorder:', err);
      }
    } else if (recorderService && typeof recorderService.stopRecording === 'function') {
      recorderService.stopRecording();
    }

    // Clean up overlay host if mounted as overlay over active game
    if (this.overlayHost && this.overlayHost.parentNode) {
      this.overlayHost.parentNode.removeChild(this.overlayHost);
      this.overlayHost = null;
    }

    // Update URL hash to trigger router transition to registerView
    if (typeof window !== 'undefined' && window.location) {
      window.location.hash = '#register';
    }

    eventBus.publish('screamer:transition-complete', {
      timestamp: Date.now()
    });
  }

  /**
   * Unmounts the jumpscare view and cleans up timers, listeners, video, and references.
   */
  unmount() {
    this.isVideoActive = false;

    if (this.animationFrameId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.transitionTimeoutId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.transitionTimeoutId);
      this.transitionTimeoutId = null;
    }

    if (this.bufferingFallbackTimeoutId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.bufferingFallbackTimeoutId);
      this.bufferingFallbackTimeoutId = null;
    }

    if (this.boundKeyDownHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDownHandler);
      this.boundKeyDownHandler = null;
    }

    if (this.videoElement) {
      if (this.boundVideoEndedHandler) {
        this.videoElement.removeEventListener('ended', this.boundVideoEndedHandler);
      }
      if (this.boundVideoPlayHandler) {
        this.videoElement.removeEventListener('play', this.boundVideoPlayHandler);
        this.videoElement.removeEventListener('playing', this.boundVideoPlayHandler);
      }
      if (this.boundVideoErrorHandler) {
        this.videoElement.removeEventListener('error', this.boundVideoErrorHandler);
      }
      try {
        this.videoElement.pause();
        this.videoElement.src = '';
      } catch {
        // Safe ignore
      }
      this.videoElement = null;
    }

    if (this.overlayHost && this.overlayHost.parentNode) {
      this.overlayHost.parentNode.removeChild(this.overlayHost);
      this.overlayHost = null;
    }

    if (this.container) {
      const viewElement = this.container.querySelector('.screamer-view');
      if (viewElement && this.boundClickHandler) {
        viewElement.removeEventListener('click', this.boundClickHandler);
        this.boundClickHandler = null;
      }
      this.container.innerHTML = '';
      this.container = null;
    }

    this.chromaCanvas = null;
    this.chromaCtx = null;
    this.isTransitioning = false;
  }

  /**
   * Generates the HTML template containing the video element, Chroma-Key canvas,
   * horrific demonic pumpkin SVG fallback, and screen-shake container.
   *
   * @returns {string} Raw HTML string.
   */
  template() {
    return `
      <section class="screamer-view" role="alert" aria-live="assertive" aria-label="¡Susto!">
        <!-- Hidden screen reader alert -->
        <h1 class="sr-only">Secuencia de terror en curso</h1>

        <!-- Screen-shake container -->
        <div class="screamer-view__shake" aria-hidden="true">
          <!-- Off-screen raw video source with green chroma background -->
          <video class="screamer-view__video" playsinline preload="auto" aria-hidden="true"></video>

          <!-- Real-time Chroma-Key Output Canvas (transparent green screen) -->
          <canvas class="screamer-view__chroma-canvas" id="screamer-chroma-canvas" aria-hidden="true"></canvas>

          <!-- Fallback Gruesome Demonic Jack-o'-Lantern Monster SVG -->
          <svg class="screamer-view__monster screamer-view__monster--hidden" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Criatura demoníaca de Halloween">
            <defs>
              <radialGradient id="monsterHeadGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#2a0008" />
                <stop offset="70%" stop-color="#140003" />
                <stop offset="100%" stop-color="#050001" />
              </radialGradient>
              <filter id="glowFrenzy" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="12" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <!-- Gnarled twisted pumpkin head silhouette -->
            <path d="M 250 40 C 230 15 200 10 195 20 C 190 30 215 45 225 50 C 140 50 40 120 30 240 C 20 370 120 480 250 485 C 380 480 480 370 470 240 C 460 120 360 50 275 50 C 285 45 310 30 305 20 C 300 10 270 15 250 40 Z"
                  fill="url(#monsterHeadGrad)" stroke="#ff1e42" stroke-width="6" stroke-linejoin="round" />

            <!-- Sinister demonic horns / ribs -->
            <path d="M 80 140 C 30 80 15 20 10 10 C 25 35 60 70 110 110 Z" fill="#ff1e42" opacity="0.8" />
            <path d="M 420 140 C 470 80 485 20 490 10 C 475 35 440 70 390 110 Z" fill="#ff1e42" opacity="0.8" />

            <!-- Piercing menacing hollow eyes with glowing crimson pupils -->
            <polygon class="screamer-view__monster-eye" points="110,170 200,210 160,250 100,210" filter="url(#glowFrenzy)" />
            <polygon class="screamer-view__monster-eye" points="390,170 300,210 340,250 400,210" filter="url(#glowFrenzy)" />

            <!-- Jagged nasal cavity -->
            <polygon points="250,240 220,290 280,290" fill="#ff1e42" />

            <!-- Horrific jagged tooth-filled maw -->
            <path class="screamer-view__monster-mouth"
                  d="M 90 330
                     L 130 355 L 145 335 L 175 365 L 195 335 L 225 375 L 250 335 L 275 375 L 305 335 L 325 365 L 355 335 L 370 355 L 410 330
                     L 380 420
                     L 345 390 L 325 430 L 295 390 L 270 440 L 250 395 L 230 440 L 205 390 L 175 430 L 155 390 L 120 420
                     Z"
                  stroke="#ffffff" stroke-width="3" filter="url(#glowFrenzy)" />
          </svg>
        </div>

        <!-- Discreet accessible skip trigger -->
        <button type="button" class="screamer-view__skip-btn" aria-label="Saltar animación de susto e ir al registro">
          Saltar [Esc]
        </button>
      </section>
    `;
  }
}

/**
 * Shared singleton instance of ScreamerView.
 */
export const screamerView = new ScreamerView();

export default screamerView;
