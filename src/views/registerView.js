/**
 * @file registerView.js
 * @description Reaction Display and Nickname Registration View for DAWlloween.
 * Features a gothic Polaroid frame presenting the captured webcam reaction (or spooky
 * fallback avatar), an accessible nickname registration form with sanitisation, and flow actions.
 * Conforms to strict UK English (en-GB) and zero local persistence.
 */

import { captureService, generateFallbackAvatar } from '../screamer/capture.js';
import { recorderService } from '../screamer/recorder.js';
import { eventBus } from '../utils/eventBus.js';
import { alerts } from '../ui/alerts.js';
import { supabaseService } from '../services/supabase.js';

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

    /** @type {string|null} */
    this.videoUrl = null;

    /** @type {boolean} */
    this.hasVideo = false;

    /** @type {boolean} Indicates video is currently packaging chunks into Blob */
    this.isProcessingVideo = false;

    /** @type {boolean} */
    this.isFallbackSnapshot = false;

    /** @type {Function|null} EventBus subscription for video recorded event */
    this.unsubscribeVideoRecorded = null;

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

    // Retrieve active in-memory video recording, check processing state, or fallback
    if (recorderService && typeof recorderService.hasRecording === 'function' && recorderService.hasRecording()) {
      this.videoUrl = recorderService.getVideoUrl();
      this.hasVideo = true;
      this.isProcessingVideo = false;
    } else if (recorderService && typeof recorderService.isPending === 'function' && recorderService.isPending()) {
      this.videoUrl = null;
      this.hasVideo = false;
      this.isProcessingVideo = true;
    } else {
      this.videoUrl = null;
      this.hasVideo = false;
      this.isProcessingVideo = false;
    }

    // Retrieve active in-memory snapshot or provide fallback avatar
    if (captureService && typeof captureService.getSnapshot === 'function' && captureService.hasSnapshot()) {
      this.snapshotDataUrl = captureService.getSnapshot();
      this.isFallbackSnapshot = captureService.isFallback();
    } else {
      this.snapshotDataUrl = generateFallbackAvatar();
      this.isFallbackSnapshot = true;
    }

    // Subscribe to video-recorded event to dynamically update the Polaroid card once ready
    if (eventBus && typeof eventBus.subscribe === 'function') {
      this.unsubscribeVideoRecorded = eventBus.subscribe('screamer:video-recorded', (data) => {
        this.handleVideoRecorded(data);
      });
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
   * Handles form validation, cloud persistence upload/insert with retries, and transition to #hall-of-fame.
   *
   * @returns {Promise<Object|null>}
   */
  async handleSubmit() {
    if (!this.container) {
      return null;
    }

    const input = this.container.querySelector('#player-nickname');
    const feedback = this.container.querySelector('#nickname-feedback');
    const submitBtn = this.container.querySelector('#btn-immortalise');

    if (!input) {
      return null;
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
      return null;
    }

    // Input is valid: clear errors, disable inputs, and display loading state
    input.classList.remove('register-form__input--error');
    if (feedback) {
      feedback.textContent = '';
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      if (typeof submitBtn.setAttribute === 'function') {
        submitBtn.setAttribute('aria-busy', 'true');
      }
      submitBtn.innerHTML = '<span>⏳ Enviando al más allá...</span>';
    }
    input.disabled = true;

    // Display progress toast
    if (alerts && typeof alerts.info === 'function') {
      alerts.info('Enviando reacción al más allá...', 'Guardando Reacción', 3500);
    }

    // If video recording is still processing chunks into a Blob, await finalisation
    if (this.isProcessingVideo && recorderService && typeof recorderService.stopRecordingAsync === 'function') {
      try {
        await recorderService.stopRecordingAsync();
      } catch (err) {
        console.warn('[RegisterView] Exception awaiting reaction recorder:', err);
      }
    }

    // Extract in-memory media references
    const videoBlob = recorderService && typeof recorderService.getVideoBlob === 'function'
      ? recorderService.getVideoBlob()
      : null;
    const mimeType = videoBlob && recorderService
      ? (recorderService.recordedMimeType || 'video/webm')
      : 'video/webm';
    const photoDataUrl = this.snapshotDataUrl;

    // Publish decoupled event immediately upon validation
    const submissionPayload = {
      nickname: validation.sanitizedNickname,
      videoBlob,
      videoUrl: this.videoUrl,
      mimeType,
      photoDataUrl: this.snapshotDataUrl,
      isFallback: this.isFallbackSnapshot,
      hasVideo: Boolean(videoBlob),
      timestamp: Date.now()
    };
    eventBus.publish('screamer:nickname-submitted', submissionPayload);

    try {
      let uploadedVideoUrl = null;
      let uploadedPhotoUrl = null;

      // 1. Upload video clip to Supabase Storage if available
      if (videoBlob) {
        const videoUpload = await supabaseService.uploadReactionMedia(videoBlob, {
          mimeType,
          useRetry: true
        });
        uploadedVideoUrl = videoUpload.publicUrl;
      }

      // 2. Upload photo snapshot (or fallback avatar) to Supabase Storage if available
      if (photoDataUrl) {
        const photoUpload = await supabaseService.uploadReactionMedia(photoDataUrl, {
          mimeType: 'image/webp',
          useRetry: true
        });
        uploadedPhotoUrl = photoUpload.publicUrl;
      }

      // 3. Persist entry in hall_of_fame database table
      const persistedRecord = await supabaseService.insertReactionRecord({
        nickname: validation.sanitizedNickname,
        videoUrl: uploadedVideoUrl,
        photoUrl: uploadedPhotoUrl
      }, { useRetry: true });

      // 4. Publish persisted event
      eventBus.publish('screamer:persisted', {
        ...submissionPayload,
        id: persistedRecord?.id,
        videoUrl: uploadedVideoUrl || this.videoUrl,
        photoUrl: uploadedPhotoUrl
      });

      // 5. Display celebratory toast
      if (alerts && typeof alerts.success === 'function') {
        alerts.success(`¡Reacción inmortalizada para "${validation.sanitizedNickname}"!`, 'Hall of Fame', 4000);
      }

      // 6. Navigate to #hall-of-fame
      if (typeof window !== 'undefined' && window.location) {
        window.location.hash = '#hall-of-fame';
      }

      return persistedRecord;
    } catch (err) {
      console.error('[RegisterView] Cloud persistence failed:', err);

      if (alerts && typeof alerts.error === 'function') {
        alerts.error(
          'No se pudo guardar tu reacción tras varios intentos. Comprueba tu conexión y vuelve a intentarlo.',
          'Error de Envío',
          5000
        );
      }

      // Restore button and input state so player can retry
      if (submitBtn) {
        submitBtn.disabled = false;
        if (typeof submitBtn.removeAttribute === 'function') {
          submitBtn.removeAttribute('aria-busy');
        }
        submitBtn.innerHTML = '<span>🏆 Inmortalizar en el Hall of Fame</span>';
      }
      input.disabled = false;
      return null;
    }
  }

  /**
   * Restarts the game flow by clearing transient snapshot and navigating to #play.
   */
  restartGame() {
    if (recorderService && typeof recorderService.clearRecording === 'function') {
      recorderService.clearRecording();
    }
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

    if (this.unsubscribeVideoRecorded) {
      this.unsubscribeVideoRecorded();
      this.unsubscribeVideoRecorded = null;
    }

    if (recorderService && typeof recorderService.clearRecording === 'function') {
      recorderService.clearRecording();
    }

    this.boundRestartHandler = null;
    this.boundSubmitHandler = null;
    this.boundInputHandler = null;
    this.snapshotDataUrl = null;
    this.videoUrl = null;
    this.hasVideo = false;
    this.isProcessingVideo = false;
    this.isFallbackSnapshot = false;
  }

  /**
   * Handles screamer:video-recorded event to dynamically update the Polaroid card.
   *
   * @param {Object} data - Video recorded event payload.
   */
  handleVideoRecorded(data) {
    this.isProcessingVideo = false;
    if (data && !data.isFallback && data.url) {
      this.videoUrl = data.url;
      this.hasVideo = true;
    } else if (data && data.isFallback) {
      this.hasVideo = false;
      this.videoUrl = null;
      if (data.fallbackDataUrl) {
        this.snapshotDataUrl = data.fallbackDataUrl;
        this.isFallbackSnapshot = true;
      }
    }
    this.updateVisualMedia();
  }

  /**
   * Dynamically updates the visual media inside the Polaroid card frame and status badge.
   */
  updateVisualMedia() {
    if (!this.container) {
      return;
    }
    const photoFrame = this.container.querySelector('.polaroid-card__photo-frame');
    const badge = this.container.querySelector('#photo-status-badge');

    if (photoFrame) {
      photoFrame.innerHTML = this.getVisualMediaMarkup();
    }
    if (badge) {
      const badgeInfo = this.getBadgeInfo();
      badge.className = badgeInfo.className;
      badge.textContent = badgeInfo.text;
    }
  }

  /**
   * Computes the display text and CSS classes for the Polaroid badge.
   *
   * @returns {{ text: string, className: string }}
   */
  getBadgeInfo() {
    if (this.hasVideo && this.videoUrl) {
      return {
        text: '🎬 Vídeo Reacción',
        className: 'polaroid-card__badge polaroid-card__badge--video'
      };
    }
    if (this.isProcessingVideo) {
      return {
        text: '⏳ Procesando Vídeo...',
        className: 'polaroid-card__badge polaroid-card__badge--processing'
      };
    }
    if (this.isFallbackSnapshot) {
      return {
        text: '🎃 Avatar Fantasmal',
        className: 'polaroid-card__badge polaroid-card__badge--fallback'
      };
    }
    return {
      text: '📸 Foto Reacción',
      className: 'polaroid-card__badge'
    };
  }

  /**
   * Generates HTML markup for the Polaroid visual media frame.
   *
   * @returns {string} HTML markup string.
   */
  getVisualMediaMarkup() {
    if (this.hasVideo && this.videoUrl) {
      return `<video src="${this.videoUrl}"
                autoplay loop muted playsinline
                class="polaroid-card__video"
                id="reaction-video-preview"
                aria-label="Vídeo de tu reacción"></video>`;
    }
    if (this.isProcessingVideo) {
      return `<div class="polaroid-card__loading" id="reaction-loading-preview" aria-live="polite">
                <div class="polaroid-card__spinner" aria-hidden="true"></div>
                <p class="polaroid-card__loading-text">Inmortalizando tu terror...</p>
                <span class="polaroid-card__loading-subtext">Un momento mientras se revela tu reacción</span>
              </div>`;
    }
    return `<img src="${this.snapshotDataUrl}"
              alt="Reacción capturada durante el susto de DAWlloween"
              class="polaroid-card__photo"
              id="reaction-photo-preview" />`;
  }

  /**
   * Generates the semantic HTML template.
   *
   * @returns {string} HTML markup string.
   */
  template() {
    const badgeInfo = this.getBadgeInfo();
    const visualMediaMarkup = this.getVisualMediaMarkup();

    return `
      <section class="register-view" aria-labelledby="register-view-heading">
        <div class="register-view__container">

          <!-- Left Column: Gothic Halloween Polaroid Photo Card -->
          <article class="polaroid-card" aria-label="Fotografía de tu reacción">
            <div class="polaroid-card__tape" aria-hidden="true"></div>

            <div class="polaroid-card__photo-frame">
              ${visualMediaMarkup}
            </div>

            <div class="polaroid-card__caption">
              <h2 class="polaroid-card__title">DAWlloween 2026</h2>
              <span class="${badgeInfo.className}" id="photo-status-badge">
                ${badgeInfo.text}
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
