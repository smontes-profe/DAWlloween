/**
 * @file hallOfFameView.js
 * @description Hall of Fame Gallery View component for DAWlloween SPA.
 * Renders an atmospheric, Mobile-First responsive CSS Grid of participant reaction
 * videos and photos fetched directly from Supabase BaaS.
 * Standards: UK English (en-GB), Accessible DOM (a11y), Zero local persistence.
 */

import { supabaseService } from '../services/supabase.js';
import { alerts } from '../ui/alerts.js';

/**
 * Escapes potentially dangerous characters from user-provided nicknames to prevent XSS.
 *
 * @param {string} str - Raw string.
 * @returns {string} Sanitised HTML-safe string.
 */
export function sanitizeText(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats an ISO date string into a user-friendly relative or localized timestamp.
 *
 * @param {string|Date} dateInput - ISO timestamp.
 * @returns {string} Human-readable time representation.
 */
export function formatRelativeDate(dateInput) {
  if (!dateInput) {
    return 'Reciente';
  }

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    return 'Reciente';
  }

  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 60) {
    return 'Hace unos segundos';
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `Hace ${diffMinutes} min${diffMinutes > 1 ? 's' : ''}`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Hace ${diffHours} h${diffHours > 1 ? 's' : ''}`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  }

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * HallOfFameView component managing the exhibition gallery lifecycle.
 */
export class HallOfFameView {
  /**
   * Initialises the HallOfFameView instance.
   *
   * @param {Object} [options={}] - Optional dependencies for testing.
   * @param {Object} [options.supabaseService] - Injected Supabase service.
   * @param {Object} [options.alertsService] - Injected Alerts service.
   */
  constructor(options = {}) {
    /** @type {HTMLElement|null} */
    this.container = null;

    /** @type {Array<Object>} */
    this.reactions = [];

    /** @type {boolean} */
    this.isLoading = false;

    /** @type {Object} */
    this.service = options.supabaseService || supabaseService;

    /** @type {Object} */
    this.alerts = options.alertsService || alerts;

    /** @type {number|null} */
    this.pollTimer = null;

    /** @type {number} */
    this.pollIntervalMs = options.pollIntervalMs ?? 30000;

    /** @type {boolean} */
    this.enablePolling = options.enablePolling ?? true;

    /** @type {Set<string>} */
    this.knownReactionIds = new Set();

    /** @type {((event: Event) => void)|null} */
    this.boundVisibilityHandler = null;

    /** @type {((event: Event) => void)|null} */
    this.boundRefreshHandler = null;

    /** @type {IntersectionObserver|null} */
    this.videoObserver = null;
  }

  /**
   * Mounts the Hall of Fame view into the target DOM container.
   *
   * @param {HTMLElement} container - The SPA host container.
   * @returns {Promise<Array<Object>>}
   */
  async mount(container) {
    if (!container) {
      return [];
    }

    this.container = container;
    this.container.innerHTML = this.template();

    this.attachEventListeners();
    this.setupVisibilityDetection();

    const initialRecords = await this.loadReactions();
    if (!this.container) {
      return initialRecords;
    }
    this.startPolling();
    return initialRecords;
  }

  /**
   * Starts periodic background polling for newly persisted reaction entries.
   */
  startPolling() {
    this.stopPolling();

    if (!this.enablePolling || this.pollIntervalMs <= 0) {
      return;
    }

    this.pollTimer = setInterval(async () => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      await this.loadReactions({ isPolling: true });
    }, this.pollIntervalMs);
  }

  /**
   * Stops active background polling timer.
   */
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Listens to page visibility change events to pause polling when inactive.
   */
  setupVisibilityDetection() {
    if (typeof document === 'undefined') {
      return;
    }

    this.boundVisibilityHandler = async () => {
      if (document.hidden) {
        this.stopPolling();
      } else {
        await this.loadReactions({ isPolling: true });
        this.startPolling();
      }
    };

    document.addEventListener('visibilitychange', this.boundVisibilityHandler);
  }

  /**
   * Returns the initial HTML template scaffold with header and loading skeletons.
   *
   * @returns {string}
   */
  template() {
    return `
      <section class="hall-view container" aria-labelledby="hall-title">
        <header class="hall-header">
          <div class="hall-header__badge">
            <span aria-hidden="true">👻</span>
            <span id="hall-count-badge">Consultando el más allá...</span>
          </div>
          <h1 id="hall-title" class="hall-header__title flicker">Hall of Fame</h1>
          <p class="hall-header__subtitle">
            El santuario de los valientes. Reacciones capturadas en directo durante la experiencia interactiva de Halloween.
          </p>
        </header>

        <nav class="hall-controls" aria-label="Controles del mural">
          <div class="hall-controls__status">
            <span class="hall-controls__pulse-dot" aria-hidden="true"></span>
            <span id="hall-live-indicator">Mural en vivo</span>
          </div>
          <div class="hall-controls__actions">
            <button id="btn-hall-refresh" class="btn-refresh" aria-label="Actualizar mural de reacciones">
              <span class="btn-refresh__icon" aria-hidden="true">🔄</span>
              <span>Actualizar</span>
            </button>
          </div>
        </nav>

        <div id="hall-grid-container" class="hall-grid" role="region" aria-label="Mosaico de Reacciones" aria-live="polite">
          ${this.renderSkeletons(6)}
        </div>

        <button id="btn-fab-refresh" class="hall-fab-refresh" aria-label="Refrescar reacciones rápidamente" title="Actualizar mural">
          <span aria-hidden="true">🔄</span>
        </button>
      </section>
    `;
  }

  /**
   * Generates a string of skeleton placeholder cards for smooth visual loading.
   *
   * @param {number} [count=6] - Number of skeleton cards.
   * @returns {string}
   */
  renderSkeletons(count = 6) {
    let skeletons = '';
    for (let i = 0; i < count; i++) {
      skeletons += `
        <article class="reaction-skeleton" aria-hidden="true">
          <div class="reaction-skeleton__media"></div>
          <div class="reaction-skeleton__body">
            <div class="reaction-skeleton__line reaction-skeleton__line--title"></div>
            <div class="reaction-skeleton__line reaction-skeleton__line--subtitle"></div>
          </div>
        </article>
      `;
    }
    return skeletons;
  }

  /**
   * Attaches interactive event listeners to buttons.
   */
  attachEventListeners() {
    if (!this.container) return;

    this.boundRefreshHandler = (event) => {
      event.preventDefault();
      this.refreshWithSpin();
    };

    const refreshBtn = this.container.querySelector('#btn-hall-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', this.boundRefreshHandler);
    }

    const fabBtn = this.container.querySelector('#btn-fab-refresh');
    if (fabBtn) {
      fabBtn.addEventListener('click', this.boundRefreshHandler);
    }
  }

  /**
   * Triggers a manual refresh with visual button spin animation.
   */
  async refreshWithSpin() {
    if (!this.container) return;

    const refreshBtn = this.container.querySelector('#btn-hall-refresh');
    const fabBtn = this.container.querySelector('#btn-fab-refresh');

    if (refreshBtn) refreshBtn.classList.add('btn-refresh--spinning');
    if (fabBtn) fabBtn.classList.add('btn-refresh--spinning');

    try {
      await this.loadReactions({ isManual: true });
    } finally {
      if (refreshBtn) refreshBtn.classList.remove('btn-refresh--spinning');
      if (fabBtn) fabBtn.classList.remove('btn-refresh--spinning');
    }
  }

  /**
   * Fetches reaction records from cloud storage/database and updates the grid.
   *
   * @param {Object} [options={}] - Load options.
   * @param {boolean} [options.isManual=false] - Whether triggered manually by user.
   * @param {boolean} [options.isPolling=false] - Whether triggered automatically by polling.
   * @returns {Promise<Array<Object>>}
   */
  async loadReactions({ isManual = false, isPolling = false } = {}) {
    if (!this.container) return [];

    this.isLoading = true;
    const gridContainer = this.container.querySelector('#hall-grid-container');
    const badge = this.container.querySelector('#hall-count-badge');

    // Only display skeletons on initial mount when no cards exist yet
    if (!isManual && !isPolling && this.reactions.length === 0 && gridContainer) {
      gridContainer.innerHTML = this.renderSkeletons(6);
    }

    try {
      const records = await this.service.fetchHallOfFame();
      const freshReactions = Array.isArray(records) ? records : [];

      // Detect new reactions compared to known IDs
      const previousSize = this.knownReactionIds.size;
      const freshIds = freshReactions.map((r) => r.id);
      const newItemsCount = previousSize > 0
        ? freshIds.filter((id) => !this.knownReactionIds.has(id)).length
        : 0;

      this.reactions = freshReactions;
      this.knownReactionIds = new Set(freshIds);

      if (badge) {
        badge.textContent = `${this.reactions.length} Alma${this.reactions.length === 1 ? '' : 's'} Inmortalizada${this.reactions.length === 1 ? '' : 's'}`;
      }

      if (gridContainer) {
        if (this.reactions.length === 0) {
          gridContainer.innerHTML = this.renderEmptyState();
        } else {
          gridContainer.innerHTML = this.reactions.map((r) => this.renderReactionCard(r)).join('');
          this.setupVideoIntersectionObserver();
        }
      }

      if (isManual && this.alerts && typeof this.alerts.info === 'function') {
        this.alerts.info('Mural de reacciones actualizado.', 'Hall of Fame', 2500);
      } else if (isPolling && newItemsCount > 0 && this.alerts && typeof this.alerts.info === 'function') {
        const message = newItemsCount === 1
          ? '¡Ha caído 1 nueva alma en el mural!'
          : `¡Han caído ${newItemsCount} nuevas almas en el mural!`;
        this.alerts.info(message, 'Hall of Fame', 3500);
      }

      return this.reactions;
    } catch (err) {
      console.error('[HallOfFameView] Failed to load reactions:', err);
      // If we already have cards on screen, keep them and only notify via alert
      if (gridContainer && this.reactions.length === 0) {
        gridContainer.innerHTML = this.renderErrorState(err.message);
      }
      if (this.alerts && typeof this.alerts.error === 'function') {
        this.alerts.error('No se pudo conectar con el inframundo.', 'Error de Conexión', 4000);
      }
      return this.reactions;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Renders a single reaction card HTML.
   *
   * @param {Object} reaction - Reaction row record.
   * @returns {string} HTML markup.
   */
  renderReactionCard(reaction) {
    const id = reaction.id || `rec-${Math.random().toString(36).substring(2, 9)}`;
    const nickname = sanitizeText(reaction.nickname || 'Anónimo');
    const timestamp = formatRelativeDate(reaction.created_at);
    const hasVideo = Boolean(reaction.video_url);
    const mediaUrl = hasVideo ? reaction.video_url : (reaction.photo_url || '');

    const badgeMarkup = hasVideo
      ? `<span class="reaction-card__type-badge reaction-card__type-badge--video" aria-label="Clip de vídeo">🎬 Vídeo</span>`
      : `<span class="reaction-card__type-badge" aria-label="Fotografía">📷 Foto</span>`;

    const mediaMarkup = hasVideo
      ? `<video class="reaction-card__video" src="${mediaUrl}" autoplay loop muted playsinline preload="metadata" title="Reacción de ${nickname}"></video>`
      : `<img class="reaction-card__image" src="${mediaUrl}" alt="Reacción de ${nickname}" loading="lazy" />`;

    return `
      <article class="reaction-card" data-id="${id}">
        <div class="reaction-card__media-container">
          ${mediaMarkup}
          ${badgeMarkup}
        </div>
        <div class="reaction-card__footer">
          <div class="reaction-card__nickname-row">
            <h2 class="reaction-card__nickname" title="${nickname}">${nickname}</h2>
          </div>
          <time class="reaction-card__timestamp" datetime="${reaction.created_at || ''}">${timestamp}</time>
        </div>
      </article>
    `;
  }

  /**
   * Renders the empty state layout when no reactions have been immortalised yet.
   *
   * @returns {string}
   */
  renderEmptyState() {
    return `
      <div class="hall-empty" role="status">
        <span class="hall-empty__icon" aria-hidden="true">🎃</span>
        <h2 class="hall-empty__title">El mural de las almas está en silencio</h2>
        <p class="hall-empty__text">
          Aún no ha caído ninguna víctima en la trampa. ¡Atrévete a entrar en la arena de supervivencia y sé la primera persona en inmortalizar tu susto!
        </p>
        <a href="#home" class="btn btn-primary" style="margin-top: var(--space-sm);">
          <span>Entrar a la Arena</span>
        </a>
      </div>
    `;
  }

  /**
   * Renders an error layout with an interactive retry button.
   *
   * @param {string} [errorMessage=''] - Error details.
   * @returns {string}
   */
  renderErrorState(errorMessage = '') {
    return `
      <div class="hall-empty" role="alert" style="border-color: var(--colour-blood-red);">
        <span class="hall-empty__icon" aria-hidden="true">⚡</span>
        <h2 class="hall-empty__title text-blood">Interrupción de Comunicación</h2>
        <p class="hall-empty__text">
          No se han podido invocar los registros de Supabase. Comprueba tu conexión a la red.
        </p>
        <button id="btn-hall-retry" class="btn btn-secondary" onclick="window.location.reload()">
          <span>Reintentar Conexión</span>
        </button>
      </div>
    `;
  }

  /**
   * Sets up an IntersectionObserver to automatically play reaction videos when
   * scrolled into the visible viewport and pause them when scrolled out of view.
   * Conserves GPU/CPU cycles and mobile device battery.
   */
  setupVideoIntersectionObserver() {
    this.disconnectVideoObserver();

    if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
      return;
    }

    try {
      this.videoObserver = new window.IntersectionObserver((entries) => {
        for (const entry of entries) {
          const video = entry.target.querySelector('video');
          if (!video) continue;

          if (entry.isIntersecting) {
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(() => {
                // Defensive catch for browser autoplay policies
              });
            }
          } else {
            video.pause();
          }
        }
      }, {
        root: null,
        threshold: 0.25
      });

      this.observeVideoCards();
    } catch (err) {
      console.warn('[HallOfFameView] IntersectionObserver initialisation failed gracefully:', err);
    }
  }

  /**
   * Attaches active IntersectionObserver to all rendered reaction cards containing video elements.
   */
  observeVideoCards() {
    if (!this.videoObserver || !this.container) return;

    const cards = this.container.querySelectorAll('.reaction-card');
    for (const card of cards) {
      if (card.querySelector('video')) {
        this.videoObserver.observe(card);
      }
    }
  }

  /**
   * Disconnects and releases active video IntersectionObserver.
   */
  disconnectVideoObserver() {
    if (this.videoObserver) {
      this.videoObserver.disconnect();
      this.videoObserver = null;
    }
  }

  /**
   * Tears down listeners and timers when view is unmounted.
   */
  destroy() {
    this.disconnectVideoObserver();

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.boundVisibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      this.boundVisibilityHandler = null;
    }

    if (this.container) {
      const refreshBtn = this.container.querySelector('#btn-hall-refresh');
      if (refreshBtn && this.boundRefreshHandler) {
        refreshBtn.removeEventListener('click', this.boundRefreshHandler);
      }

      const fabBtn = this.container.querySelector('#btn-fab-refresh');
      if (fabBtn && this.boundRefreshHandler) {
        fabBtn.removeEventListener('click', this.boundRefreshHandler);
      }

      this.container = null;
    }
  }
}

export default HallOfFameView;
