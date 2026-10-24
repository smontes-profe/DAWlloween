/**
 * @file registerView.js
 * @description Reaction Display and Nickname Registration View for DAWlloween.
 * Features a gothic Polaroid frame presenting the captured webcam reaction (or spooky
 * fallback avatar), an accessible nickname registration form with sanitisation, and flow actions.
 * Conforms to strict UK English (en-GB) and zero local persistence.
 */

import { captureService, generateFallbackAvatar } from '../screamer/capture.js';
import { eventBus } from '../utils/eventBus.js';
import { alerts } from '../ui/alerts.js';

/**
 * Validates and sanitises a player nickname string.
 * Enforces length between 3 and 20 characters and strips dangerous HTML injection characters.
 *
 * @param {string} input - Raw nickname input.
 * @returns {{ isValid: boolean, sanitizedNickname?: string, errorMessage?: string }}
 */
export function validateNickname(input) {
  if (typeof input !== 'string') {
    return {
      isValid: false,
      errorMessage: 'El apodo debe ser una cadena de texto válida.'
    };
  }

  // Trim whitespace
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      errorMessage: 'Por favor, introduce tu apodo.'
    };
  }

  // Sanitize dangerous HTML entities to prevent injection
  const sanitized = trimmed.replace(/[<>"'&/]/g, '');

  if (sanitized.length < 3) {
    return {
      isValid: false,
      errorMessage: 'El apodo debe tener al menos 3 caracteres.'
    };
  }

  if (sanitized.length > 20) {
    return {
      isValid: false,
      errorMessage: 'El apodo no puede superar los 20 caracteres.'
    };
  }

  return {
    isValid: true,
    sanitizedNickname: sanitized
  };
}

/**
 * RegisterView component managing reaction review, nickname validation, and submission.
 */
export class RegisterView {
  /**
   * Initialises the RegisterView instance.
   */
  constructor() {
    /** @type {HTMLElement|null} */
    this.container = null;

    /** @type {string|null} */
    this.snapshotDataUrl = null;

    /** @type {boolean} */
    this.isFallbackSnapshot = false;

    /** @type {((event: Event) => void)|null} */
    this.boundRestartHandler = null;

    /** @type {((event: Event) => void)|null} */
    this.boundSubmitHandler = null;

    /** @type {((event: Event) => void)|null} */
    this.boundInputHandler = null;
  }

  /**
   * Mounts the reaction review and registration view.
   *
   * @param {HTMLElement} container - Target mount container.
   */
  mount(container) {
    this.container = container;

    // Retrieve active in-memory snapshot or provide fallback avatar
    if (captureService && typeof captureService.getSnapshot === 'function' && captureService.hasSnapshot()) {
      this.snapshotDataUrl = captureService.getSnapshot();
      this.isFallbackSnapshot = captureService.isFallback();
    } else {
      this.snapshotDataUrl = generateFallbackAvatar();
      this.isFallbackSnapshot = true;
    }

    // Render DOM layout
    this.container.innerHTML = this.template();

    // Attach restart listener
    const restartBtn = this.container.querySelector('#btn-play-again');
    if (restartBtn) {
      this.boundRestartHandler = (event) => {
        event.preventDefault();
        this.restartGame();
      };
      restartBtn.addEventListener('click', this.boundRestartHandler);
    }

    // Attach live character counter listener
    const nicknameInput = this.container.querySelector('#player-nickname');
    const counterDisplay = this.container.querySelector('#nickname-counter');
    const feedbackDisplay = this.container.querySelector('#nickname-feedback');

    if (nicknameInput && counterDisplay) {
      this.boundInputHandler = () => {
        const currentLength = nicknameInput.value.length;
        counterDisplay.textContent = `${currentLength} / 20`;

        if (currentLength >= 3 && currentLength <= 20) {
          nicknameInput.classList.remove('register-form__input--error');
          if (feedbackDisplay) {
            feedbackDisplay.textContent = '';
          }
        }
      };
      nicknameInput.addEventListener('input', this.boundInputHandler);
    }

    // Attach form submission listener
    const form = this.container.querySelector('#register-nickname-form');
    if (form) {
      this.boundSubmitHandler = (event) => {
        event.preventDefault();
        this.handleSubmit();
      };
      form.addEventListener('submit', this.boundSubmitHandler);
    }
  }

  /**
   * Handles form validation, EventBus emission, and transition to #hall-of-fame.
   */
  handleSubmit() {
    if (!this.container) {
      return;
    }

    const input = this.container.querySelector('#player-nickname');
    const feedback = this.container.querySelector('#nickname-feedback');
    const submitBtn = this.container.querySelector('#btn-immortalise');

    if (!input) {
      return;
    }

    const validation = validateNickname(input.value);

    if (!validation.isValid) {
      input.classList.add('register-form__input--error');
      if (feedback) {
        feedback.textContent = validation.errorMessage;
      }
      if (typeof input.focus === 'function') {
        input.focus();
      }
      return;
    }

    // Input is valid: clear errors and disable button
    input.classList.remove('register-form__input--error');
    if (feedback) {
      feedback.textContent = '';
    }
    if (submitBtn) {
      submitBtn.disabled = true;
    }

    // Publish decoupled event payload for EPIC3 integration
    const payload = {
      nickname: validation.sanitizedNickname,
      photoDataUrl: this.snapshotDataUrl,
      isFallback: this.isFallbackSnapshot,
      timestamp: Date.now()
    };

    eventBus.publish('screamer:nickname-submitted', payload);

    if (alerts && typeof alerts.success === 'function') {
      alerts.success(`¡Reacción inmortalizada para "${validation.sanitizedNickname}"!`);
    }

    // Navigate to #hall-of-fame
    if (typeof window !== 'undefined' && window.location) {
      window.location.hash = '#hall-of-fame';
    }
  }

  /**
   * Restarts the game flow by clearing transient snapshot and navigating to #play.
   */
  restartGame() {
    if (captureService && typeof captureService.clearSnapshot === 'function') {
      captureService.clearSnapshot();
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.hash = '#play';
    }
  }

  /**
   * Unmounts the view and cleans up event listeners and references.
   */
  unmount() {
    if (this.container) {
      const restartBtn = this.container.querySelector('#btn-play-again');
      if (restartBtn && this.boundRestartHandler) {
        restartBtn.removeEventListener('click', this.boundRestartHandler);
      }

      const form = this.container.querySelector('#register-nickname-form');
      if (form && this.boundSubmitHandler) {
        form.removeEventListener('submit', this.boundSubmitHandler);
      }

      const nicknameInput = this.container.querySelector('#player-nickname');
      if (nicknameInput && this.boundInputHandler) {
        nicknameInput.removeEventListener('input', this.boundInputHandler);
      }

      this.container.innerHTML = '';
      this.container = null;
    }

    this.boundRestartHandler = null;
    this.boundSubmitHandler = null;
    this.boundInputHandler = null;
    this.snapshotDataUrl = null;
    this.isFallbackSnapshot = false;
  }

  /**
   * Generates the semantic HTML template.
   *
   * @returns {string} HTML markup string.
   */
  template() {
    const badgeText = this.isFallbackSnapshot
      ? '🎃 Avatar Fantasmal'
      : '📸 Foto Reacción';

    const badgeClass = this.isFallbackSnapshot
      ? 'polaroid-card__badge polaroid-card__badge--fallback'
      : 'polaroid-card__badge';

    return `
      <section class="register-view" aria-labelledby="register-view-heading">
        <div class="register-view__container">

          <!-- Left Column: Gothic Halloween Polaroid Photo Card -->
          <article class="polaroid-card" aria-label="Fotografía de tu reacción">
            <div class="polaroid-card__tape" aria-hidden="true"></div>

            <div class="polaroid-card__photo-frame">
              <img src="${this.snapshotDataUrl}"
                   alt="Reacción capturada durante el susto de DAWlloween"
                   class="polaroid-card__photo"
                   id="reaction-photo-preview" />
            </div>

            <div class="polaroid-card__caption">
              <h2 class="polaroid-card__title">DAWlloween 2026</h2>
              <span class="${badgeClass}" id="photo-status-badge">
                ${badgeText}
              </span>
            </div>
          </article>

          <!-- Right Column: Registration Form Panel -->
          <div class="register-panel">
            <header class="register-panel__header">
              <h1 id="register-view-heading" class="register-panel__title">¡Sobreviviste al Clímax!</h1>
              <p class="register-panel__subtitle">
                Tu terror ha sido inmortalizado. Introduce tu apodo para registrar tu hazaña en el Hall of Fame.
              </p>
            </header>

            <form class="register-form" id="register-nickname-form" novalidate>
              <div class="register-form__group">
                <div class="register-form__label-row">
                  <label for="player-nickname" class="register-form__label">
                    Tu Apodo / Nickname
                  </label>
                  <span class="register-form__counter" id="nickname-counter" aria-live="polite">
                    0 / 20
                  </span>
                </div>

                <input type="text"
                       id="player-nickname"
                       name="nickname"
                       class="register-form__input"
                       placeholder="ej. VampiroDAW"
                       maxlength="20"
                       minlength="3"
                       autocomplete="off"
                       spellcheck="false"
                       aria-describedby="nickname-feedback"
                       required />

                <div id="nickname-feedback"
                     class="register-form__feedback"
                     role="alert"
                     aria-live="polite"></div>
              </div>

              <div class="register-form__actions">
                <button type="submit"
                        class="btn-immortalise"
                        id="btn-immortalise"
                        aria-label="Inmortalizar reacción en el Hall of Fame">
                  <span>🏆 Inmortalizar en el Hall of Fame</span>
                </button>

                <button type="button"
                        class="btn-play-again"
                        id="btn-play-again"
                        aria-label="Jugar de nuevo otra partida">
                  <span>🔁 Jugar de Nuevo</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </section>
    `;
  }
}

/**
 * Shared singleton instance of RegisterView.
 */
export const registerView = new RegisterView();

export default registerView;
