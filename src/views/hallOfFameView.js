/**
 * @file hallOfFameView.js
 * @description Hall of Fame Gallery View component for DAWlloween SPA.
 * Renders an atmospheric, Mobile-First responsive CSS Grid of participant reaction
 * videos and photos fetched directly from Supabase BaaS.
 * Standards: UK English (en-GB), Accessible DOM (a11y), Zero local persistence.
 */

import { supabaseService } from '../services/supabase.js';
import { adminAuth } from '../services/adminAuth.js';
import { alerts } from '../ui/alerts.js';
import { eventBus } from '../utils/eventBus.js';

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
   * @param {Object} [options.authService] - Injected Admin authentication service.
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

    /** @type {Object} */
    this.authService = options.authService || adminAuth;

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

    /** @type {((event: Event) => void)|null} */
    this.boundAdminLogoutHandler = null;

    /** @type {((event: Event) => void)|null} */
    this.boundGridClickHandler = null;

    /** @type {((event: KeyboardEvent) => void)|null} */
    this.boundModalKeyHandler = null;

    /** @type {Function|null} */
    this.boundRecordDeletedHandler = null;

    /** @type {Function|null} */
    this.eventBusUnsubscribe = null;

    /** @type {Set<string>} */
    this.deletingIds = new Set();

    /** @type {HTMLElement|null} */
    this.activeModal = null;

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

    // Subscribe to reactive cloud record deletion events
    this.boundRecordDeletedHandler = (payload) => {
      if (payload && payload.id) {
        // Skip if this instance is actively processing the deletion and reload flow
        if (this.deletingIds && this.deletingIds.has(String(payload.id))) {
          return;
        }
        this.removeReactionFromDom(payload.id);
      }
    };
    if (eventBus && typeof eventBus.subscribe === 'function') {
      this.eventBusUnsubscribe = eventBus.subscribe('hall-of-fame:record-deleted', this.boundRecordDeletedHandler);
    }

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
          ${this.renderAdminControls()}
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
   * Renders the administrative moderation banner if session is active.
   *
   * @returns {string}
   */
  renderAdminControls() {
    if (!this.authService || !this.authService.isAuthenticated()) {
      return '';
    }

    return `
      <div class="hall-controls__admin-bar" id="hall-admin-bar">
        <span class="admin-badge">🛡️ Modo Moderador</span>
        <button id="btn-admin-logout" class="btn btn--secondary btn--sm" type="button" aria-label="Cerrar sesión de moderador">
          🚪 Cerrar Sesión
        </button>
      </div>
    `;
  }

  /**
   * Attaches interactive event listeners to buttons and delegated grid actions.
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

    const adminLogoutBtn = this.container.querySelector('#btn-admin-logout');
    if (adminLogoutBtn) {
      this.boundAdminLogoutHandler = (event) => {
        event.preventDefault();
        this.authService.logout();
        if (this.alerts && typeof this.alerts.info === 'function') {
          this.alerts.info('Sesión de administración cerrada.', 'Moderación', 2500);
        }
        this.updateAdminState();
      };
      adminLogoutBtn.addEventListener('click', this.boundAdminLogoutHandler);
    }

    const gridContainer = this.container.querySelector('#hall-grid-container');
    if (gridContainer && typeof gridContainer.addEventListener === 'function' && !this.boundGridClickHandler) {
      this.boundGridClickHandler = (event) => {
        const deleteBtn = event.target.closest('[data-action="delete"]');
        if (deleteBtn) {
          event.preventDefault();
          event.stopPropagation();
          const id = deleteBtn.getAttribute('data-id');
          const nickname = deleteBtn.getAttribute('data-nickname');
          const card = deleteBtn.closest('.reaction-card');
          this.openDeleteConfirmationModal(id, nickname, card);
        }
      };
      gridContainer.addEventListener('click', this.boundGridClickHandler);
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

    const isAdmin = Boolean(this.authService && this.authService.isAuthenticated());
    const deleteBtnMarkup = isAdmin
      ? `<button type="button" class="btn-reaction-delete" data-action="delete" data-id="${id}" data-nickname="${nickname}" aria-label="Eliminar reacción de ${nickname}" title="Eliminar reacción">
           <span aria-hidden="true">🗑️</span>
           <span>Eliminar</span>
         </button>`
      : '';

    return `
      <article class="reaction-card" data-id="${id}">
        <div class="reaction-card__media-container">
          ${mediaMarkup}
          ${badgeMarkup}
          ${deleteBtnMarkup}
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
   * Updates administrative UI elements reactively when auth state changes without full page reload.
   */
  updateAdminState() {
    if (!this.container) return;

    // Update controls navigation
    const existingAdminBar = this.container.querySelector('#hall-admin-bar');
    const controlsNav = this.container.querySelector('.hall-controls');

    if (this.authService.isAuthenticated()) {
      if (!existingAdminBar && controlsNav) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.renderAdminControls();
        const newBar = tempDiv.firstElementChild;
        if (newBar) {
          const actionsDiv = controlsNav.querySelector('.hall-controls__actions');
          controlsNav.insertBefore(newBar, actionsDiv);
        }
      }
    } else {
      if (existingAdminBar) {
        existingAdminBar.remove();
      }
    }

    // Update reaction cards to show or remove delete buttons
    const gridContainer = this.container.querySelector('#hall-grid-container');
    if (gridContainer && this.reactions.length > 0) {
      gridContainer.innerHTML = this.reactions.map((r) => this.renderReactionCard(r)).join('');
      this.setupVideoIntersectionObserver();
    }

    this.attachEventListeners();
  }

  /**
   * Opens an accessible confirmation dialog modal in European Spanish before deleting a reaction.
   *
   * @param {string|number} id - Record ID to delete.
   * @param {string} nickname - Participant nickname for confirmation copy.
   * @param {HTMLElement|null} cardElement - DOM card element for reactive deletion.
   */
  openDeleteConfirmationModal(id, nickname, cardElement) {
    this.closeModal();

    const reaction = this.reactions.find((r) => String(r.id) === String(id));
    const cleanNickname = sanitizeText(nickname || reaction?.nickname || 'esta persona');

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = 'modal-delete-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog panel-surface';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'modal-delete-title');

    // Header
    const header = document.createElement('div');
    header.className = 'modal-dialog__header';
    const title = document.createElement('h2');
    title.id = 'modal-delete-title';
    title.className = 'text-display text-blood';
    title.textContent = '¿Eliminar reacción?';
    header.appendChild(title);

    // Body
    const body = document.createElement('div');
    body.className = 'modal-dialog__body';
    const question = document.createElement('p');
    question.innerHTML = `¿Estás seguro de que deseas eliminar permanentemente la reacción de <strong>${cleanNickname}</strong>?`;
    const notice = document.createElement('p');
    notice.className = 'text-muted text-sm';
    notice.textContent = 'Esta acción purgará los archivos multimedia de la nube y eliminará el registro de forma irreversible.';
    body.appendChild(question);
    body.appendChild(notice);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'modal-dialog__actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.id = 'modal-btn-confirm';
    confirmBtn.className = 'btn btn--danger';
    confirmBtn.textContent = 'Eliminar Definitivamente';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.id = 'modal-btn-cancel';
    cancelBtn.className = 'btn btn--secondary';
    cancelBtn.textContent = 'Cancelar';

    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);

    dialog.appendChild(header);
    dialog.appendChild(body);
    dialog.appendChild(actions);

    backdrop.appendChild(dialog);
    if (typeof document !== 'undefined' && document.body) {
      document.body.appendChild(backdrop);
    }
    this.activeModal = backdrop;

    // Close on cancel button
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.closeModal();
      });
      if (typeof cancelBtn.focus === 'function') {
        cancelBtn.focus();
      }
    }

    // Close on backdrop click outside dialog
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.closeModal();
      }
    });

    // Close on Escape key
    this.boundModalKeyHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this.boundModalKeyHandler);
    }

    // Confirm deletion action
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        // 1. Close modal immediately so the user can observe the reaction card in the live gallery
        this.closeModal();

        // 2. Identify target card and its delete button
        const targetCard = cardElement || (this.container && this.container.querySelector(`.reaction-card[data-id="${id}"]`));
        const deleteBtn = targetCard
          ? (targetCard.querySelector('.btn-reaction-delete') || targetCard.querySelector('[data-action="delete"]'))
          : null;

        // 3. Mark as actively deleting, disable delete button and display loading spinner
        this.deletingIds.add(String(id));
        if (deleteBtn) {
          deleteBtn.disabled = true;
          deleteBtn.classList.add('btn-reaction-delete--loading');
          deleteBtn.innerHTML = '<span class="reaction-delete-spinner" aria-hidden="true">⏳</span> <span>Eliminando...</span>';
        }

        try {
          // 4. Send deletion request to Supabase
          await this.service.deleteReactionRecord(id, {
            videoUrl: reaction?.video_url,
            photoUrl: reaction?.photo_url
          });

          // 5. Reload list of elements directly from Supabase to guarantee cloud synchronisation
          if (this.container) {
            await this.loadReactions({ isManual: true });
          } else {
            this.removeReactionFromDom(id, cardElement);
          }

          if (this.alerts && typeof this.alerts.success === 'function') {
            this.alerts.success('Reacción eliminada permanentemente.', 'Moderación', 3000);
          }
        } catch (err) {
          console.error('[HallOfFameView] Error deleting reaction record:', err);
          // Restore button state on error
          if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.classList.remove('btn-reaction-delete--loading');
            deleteBtn.innerHTML = '<span aria-hidden="true">🗑️</span> <span>Eliminar</span>';
          }
          if (this.alerts && typeof this.alerts.error === 'function') {
            this.alerts.error('No se pudo eliminar de la base de datos. Comprueba las políticas RLS.', 'Error de Moderación', 5000);
          }
        } finally {
          this.deletingIds.delete(String(id));
        }
      });
    }
  }

  /**
   * Closes and removes the confirmation modal dialog.
   */
  closeModal() {
    if (this.boundModalKeyHandler && typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.boundModalKeyHandler);
      this.boundModalKeyHandler = null;
    }

    if (this.activeModal) {
      if (typeof this.activeModal.remove === 'function') {
        this.activeModal.remove();
      } else if (this.activeModal.parentNode) {
        this.activeModal.parentNode.removeChild(this.activeModal);
      }
      this.activeModal = null;
    }
  }

  /**
   * Removes a reaction card from the live DOM and updates badge statistics.
   *
   * @param {string|number} id - Record ID.
   * @param {HTMLElement|null} [cardElement] - Optional card element reference.
   */
  removeReactionFromDom(id, cardElement = null) {
    const targetCard = cardElement || (this.container && this.container.querySelector(`.reaction-card[data-id="${id}"]`));
    if (targetCard) {
      if (typeof targetCard.remove === 'function') {
        targetCard.remove();
      } else if (targetCard.parentNode) {
        targetCard.parentNode.removeChild(targetCard);
      }
    }

    this.reactions = this.reactions.filter((r) => String(r.id) !== String(id));
    this.knownReactionIds.delete(id);

    const badge = this.container ? this.container.querySelector('#hall-count-badge') : null;
    if (badge) {
      badge.textContent = `${this.reactions.length} Alma${this.reactions.length === 1 ? '' : 's'} Inmortalizada${this.reactions.length === 1 ? '' : 's'}`;
    }

    const gridContainer = this.container ? this.container.querySelector('#hall-grid-container') : null;
    if (gridContainer && this.reactions.length === 0) {
      gridContainer.innerHTML = this.renderEmptyState();
    }
  }

  /**
   * Alias for destroy lifecycle method for router compatibility.
   */
  unmount() {
    this.destroy();
  }

  /**
   * Tears down listeners and timers when view is unmounted.
   */
  destroy() {
    this.disconnectVideoObserver();
    this.closeModal();

    if (this.eventBusUnsubscribe) {
      this.eventBusUnsubscribe();
      this.eventBusUnsubscribe = null;
    }

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

      const adminLogoutBtn = this.container.querySelector('#btn-admin-logout');
      if (adminLogoutBtn && this.boundAdminLogoutHandler) {
        adminLogoutBtn.removeEventListener('click', this.boundAdminLogoutHandler);
      }

      const gridContainer = this.container.querySelector('#hall-grid-container');
      if (gridContainer && typeof gridContainer.removeEventListener === 'function' && this.boundGridClickHandler) {
        gridContainer.removeEventListener('click', this.boundGridClickHandler);
      }

      this.container = null;
    }

    this.boundRefreshHandler = null;
    this.boundAdminLogoutHandler = null;
    this.boundGridClickHandler = null;
    this.boundRecordDeletedHandler = null;
  }
}

export default HallOfFameView;
