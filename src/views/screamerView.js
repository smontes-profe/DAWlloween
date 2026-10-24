/**
 * @file screamerView.js
 * @description Fullscreen Jumpscare view component for DAWlloween.
 * Features aggressive visual shock effects (strobe flashing, gruesome demonic
 * silhouette, chaotic screen shake) and automatic timed transition to #register.
 * Follows strict UK English (en-GB) and zero local persistence.
 */

import { audioService } from '../services/audio.js';
import { eventBus } from '../utils/eventBus.js';

/**
 * Duration in milliseconds before auto-transitioning from the jumpscare to #register.
 * Conforms to the 1.5s - 2.0s specification range.
 * @constant {number}
 */
const SCREAMER_DURATION_MS = 1650;

/**
 * ScreamerView component handling the climactic jumpscare shock sequence.
 */
export class ScreamerView {
  /**
   * Initialises the ScreamerView instance.
   */
  constructor() {
    /** @type {HTMLElement|null} */
    this.container = null;

    /** @type {number|null} */
    this.transitionTimeoutId = null;

    /** @type {boolean} */
    this.isTransitioning = false;

    /** @type {((event: KeyboardEvent) => void)|null} */
    this.boundKeyDownHandler = null;

    /** @type {((event: MouseEvent) => void)|null} */
    this.boundClickHandler = null;
  }

  /**
   * Mounts the jumpscare view into the provided root container.
   *
   * @param {HTMLElement} container - The main container element.
   */
  mount(container) {
    this.container = container;
    this.isTransitioning = false;

    // Render fullscreen shock DOM structure
    this.container.innerHTML = this.template();

    // Trigger procedural screamer sound sting if available
    try {
      audioService.playScreamer();
    } catch (error) {
      console.warn('[ScreamerView] Audio screech synthesis fallback:', error);
    }

    // Bind accessibility keyboard skip (Escape / Space / Enter)
    this.boundKeyDownHandler = (event) => {
      if (['Escape', ' ', 'Enter'].includes(event.key)) {
        event.preventDefault();
        this.transitionToRegister();
      }
    };
    window.addEventListener('keydown', this.boundKeyDownHandler);

    // Bind click / tap to skip
    const viewElement = this.container.querySelector('.screamer-view');
    if (viewElement) {
      this.boundClickHandler = () => {
        this.transitionToRegister();
      };
      viewElement.addEventListener('click', this.boundClickHandler);
    }

    // Schedule automatic timed transition to #register
    this.transitionTimeoutId = window.setTimeout(() => {
      this.transitionToRegister();
    }, SCREAMER_DURATION_MS);
  }

  /**
   * Transitions navigation seamlessly from #screamer to #register.
   */
  transitionToRegister() {
    if (this.isTransitioning) {
      return;
    }
    this.isTransitioning = true;

    if (this.transitionTimeoutId !== null) {
      window.clearTimeout(this.transitionTimeoutId);
      this.transitionTimeoutId = null;
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
   * Unmounts the jumpscare view and cleans up timers, listeners, and references.
   */
  unmount() {
    if (this.transitionTimeoutId !== null) {
      window.clearTimeout(this.transitionTimeoutId);
      this.transitionTimeoutId = null;
    }

    if (this.boundKeyDownHandler) {
      window.removeEventListener('keydown', this.boundKeyDownHandler);
      this.boundKeyDownHandler = null;
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

    this.isTransitioning = false;
  }

  /**
   * Generates the HTML template containing the horrific demonic pumpkin SVG,
   * strobe overlay, CRT glitch scanlines, and screen-shake container.
   *
   * @returns {string} Raw HTML string.
   */
  template() {
    return `
      <section class="screamer-view" role="alert" aria-live="assertive" aria-label="¡Susto!">
        <!-- Hidden screen reader alert -->
        <h1 class="sr-only">Secuencia de terror en curso</h1>

        <!-- Strobe flash overlay -->
        <div class="screamer-view__strobe" aria-hidden="true"></div>

        <!-- Violent jitter and screen-shake container -->
        <div class="screamer-view__shake" aria-hidden="true">
          <!-- Gruesome Demonic Jack-o'-Lantern Monster SVG -->
          <svg class="screamer-view__monster" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Criatura demoníaca de Halloween">
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

        <!-- CRT Glitch scanlines and vignette -->
        <div class="screamer-view__glitch" aria-hidden="true"></div>

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

