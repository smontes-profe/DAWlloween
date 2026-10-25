/**
 * @file alerts.js
 * @description UI Notification Service managing accessible, atmospheric toast alerts.
 * Integrates with the global Event Bus to decouple alert triggers from display logic.
 * Follows UK English (en-GB) naming standards and accessibility (a11y) best practices.
 */

import { eventBus } from '../utils/eventBus.js';

/**
 * Default notification configuration parameters.
 */
const DEFAULT_NOTIFICATION_OPTIONS = {
  type: 'info',
  title: '',
  duration: 4000,
  dismissible: true
};

/**
 * Thematic icons matching the Halloween design system.
 */
const THEME_ICONS = {
  info: '🔮',
  warning: '⚠️',
  error: '🩸',
  success: '🧪'
};

/**
 * Toast Notification Service.
 */
export class AlertService {
  /**
   * Initialise the notification service and bind to the Event Bus.
   *
   * @param {HTMLElement|string} [containerSelector='#toast-container'] - DOM container reference or CSS selector.
   */
  constructor(containerSelector = '#toast-container') {
    this.containerSelector = containerSelector;
    this.container = null;
    this.activeToasts = new Set();
    this.unsubscribeEventBus = null;

    this.initialise();
  }

  /**
   * Resolve the DOM container and wire the Event Bus listener.
   */
  initialise() {
    this.ensureContainer();

    // Listen for decoupled alert requests dispatched through the Event Bus
    if (eventBus && typeof eventBus.subscribe === 'function') {
      const unsubAlert = eventBus.subscribe('ui:alert', (payload) => {
        if (payload) {
          this.show(payload);
        }
      });

      const unsubRetry = eventBus.subscribe('storage:retry', (payload) => {
        if (payload) {
          this.warning(
            `Conexión inestable con el inframundo. Reintentando (${payload.attempt}/${payload.maxRetries})...`,
            'Reintentando Conexión'
          );
        }
      });

      const unsubError = eventBus.subscribe('storage:error', (payload) => {
        if (payload) {
          this.error(
            'No se pudo conectar con el más allá tras varios intentos. Comprueba la red.',
            'Error de Envío'
          );
        }
      });

      this.unsubscribeEventBus = () => {
        if (typeof unsubAlert === 'function') unsubAlert();
        if (typeof unsubRetry === 'function') unsubRetry();
        if (typeof unsubError === 'function') unsubError();
      };
    }
  }

  /**
   * Ensure that the host toast container exists in the DOM.
   * Creates an accessible fallback if missing.
   *
   * @returns {HTMLElement} The resolved toast container element.
   */
  ensureContainer() {
    if (typeof document === 'undefined') {
      return null;
    }

    const isContained = document.body && typeof document.body.contains === 'function'
      ? document.body.contains(this.container)
      : true;

    if (!this.container || !isContained) {
      let element = null;
      if (typeof this.containerSelector === 'string') {
        element = document.querySelector(this.containerSelector);
      } else if (this.containerSelector instanceof HTMLElement) {
        element = this.containerSelector;
      }

      if (!element) {
        element = document.createElement('aside');
        element.id = 'toast-container';
        element.className = 'toast-container';
        element.setAttribute('role', 'region');
        element.setAttribute('aria-label', 'Notificaciones del sistema');
        element.setAttribute('aria-live', 'polite');
        element.setAttribute('aria-atomic', 'false');
        document.body.appendChild(element);
      }
      this.container = element;
    }

    return this.container;
  }

  /**
   * Display a toast notification with the specified options.
   *
   * @param {Object|string} options - Notification options object or plain message string.
   * @param {string} [options.message] - The notification message text.
   * @param {string} [options.title] - Optional title for the notification.
   * @param {('info'|'warning'|'error'|'success')} [options.type='info'] - Thematic notification type.
   * @param {number} [options.duration=4000] - Duration in milliseconds before auto-dismissal (0 for persistent).
   * @param {boolean} [options.dismissible=true] - Whether to render an explicit close button.
   * @returns {HTMLElement|null} The created toast element, or null if execution environment is invalid.
   */
  show(options) {
    if (typeof document === 'undefined') {
      return null;
    }

    const config = typeof options === 'string'
      ? { ...DEFAULT_NOTIFICATION_OPTIONS, message: options }
      : { ...DEFAULT_NOTIFICATION_OPTIONS, ...options };

    if (!config.message || typeof config.message !== 'string') {
      return null;
    }

    const host = this.ensureContainer();
    if (!host) {
      return null;
    }

    // Determine accessibility role: errors/warnings are assertive alerts; others are polite status updates
    const isUrgent = config.type === 'error' || config.type === 'warning';
    const alertRole = isUrgent ? 'alert' : 'status';

    const toastElement = document.createElement('div');
    toastElement.className = `toast toast--${config.type}`;
    toastElement.setAttribute('role', alertRole);

    const iconGlyph = THEME_ICONS[config.type] || THEME_ICONS.info;

    // Build icon element
    const iconElement = document.createElement('span');
    iconElement.className = 'toast__icon';
    iconElement.setAttribute('aria-hidden', 'true');
    iconElement.textContent = iconGlyph;
    toastElement.appendChild(iconElement);

    // Build content wrapper
    const contentElement = document.createElement('div');
    contentElement.className = 'toast__content';

    if (config.title) {
      const titleElement = document.createElement('h4');
      titleElement.className = 'toast__title';
      titleElement.textContent = config.title;
      contentElement.appendChild(titleElement);
    }

    const messageElement = document.createElement('p');
    messageElement.className = 'toast__message';
    messageElement.textContent = config.message;
    contentElement.appendChild(messageElement);

    toastElement.appendChild(contentElement);

    // Build close button if dismissible
    if (config.dismissible) {
      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'toast__close';
      closeButton.setAttribute('aria-label', 'Cerrar notificación');
      closeButton.innerHTML = '&times;';
      closeButton.addEventListener('click', () => {
        this.dismiss(toastElement);
      });
      toastElement.appendChild(closeButton);
    }

    // Mount toast into container
    host.appendChild(toastElement);
    this.activeToasts.add(toastElement);

    // Schedule automatic dismissal if duration is greater than 0
    if (config.duration > 0) {
      const timerId = setTimeout(() => {
        this.dismiss(toastElement);
      }, config.duration);

      // Store timer reference on the element in case dismissed manually
      toastElement._autoDismissTimer = timerId;
    }

    return toastElement;
  }

  /**
   * Helper for informational notifications.
   *
   * @param {string} message - Message text.
   * @param {string} [title='Information'] - Optional title.
   * @param {number} [duration=4000] - Duration in ms.
   * @returns {HTMLElement|null}
   */
  info(message, title = 'Información', duration = 4000) {
    return this.show({ message, title, type: 'info', duration });
  }

  /**
   * Helper for success notifications.
   *
   * @param {string} message - Message text.
   * @param {string} [title='Éxito'] - Optional title.
   * @param {number} [duration=4000] - Duration in ms.
   * @returns {HTMLElement|null}
   */
  success(message, title = 'Éxito', duration = 4000) {
    return this.show({ message, title, type: 'success', duration });
  }

  /**
   * Helper for warning notifications.
   *
   * @param {string} message - Message text.
   * @param {string} [title='Aviso'] - Optional title.
   * @param {number} [duration=5000] - Duration in ms.
   * @returns {HTMLElement|null}
   */
  warning(message, title = 'Aviso', duration = 5000) {
    return this.show({ message, title, type: 'warning', duration });
  }

  /**
   * Helper for error notifications.
   *
   * @param {string} message - Message text.
   * @param {string} [title='Error'] - Optional title.
   * @param {number} [duration=6000] - Duration in ms.
   * @returns {HTMLElement|null}
   */
  error(message, title = 'Error', duration = 6000) {
    return this.show({ message, title, type: 'error', duration });
  }

  /**
   * Dismiss and animate removal of a toast notification.
   *
   * @param {HTMLElement} toastElement - The toast element to dismiss.
   */
  dismiss(toastElement) {
    if (!toastElement || !toastElement.parentNode) {
      return;
    }

    if (toastElement._autoDismissTimer) {
      clearTimeout(toastElement._autoDismissTimer);
      delete toastElement._autoDismissTimer;
    }

    // Add closing animation class defined in styles/main.css
    toastElement.classList.add('toast--closing');

    // Wait for the CSS transition/animation to complete before unmounting from DOM
    const handleAnimationEnd = () => {
      toastElement.removeEventListener('animationend', handleAnimationEnd);
      if (toastElement.parentNode) {
        toastElement.parentNode.removeChild(toastElement);
      }
      this.activeToasts.delete(toastElement);
    };

    toastElement.addEventListener('animationend', handleAnimationEnd, { once: true });

    // Fallback safety timeout in case animationend does not fire
    setTimeout(() => {
      handleAnimationEnd();
    }, 300);
  }

  /**
   * Dismiss all currently active toast notifications.
   */
  clearAll() {
    const toastsCopy = Array.from(this.activeToasts);
    for (const toast of toastsCopy) {
      this.dismiss(toast);
    }
  }

  /**
   * Clean up event listeners and detach container.
   */
  destroy() {
    this.clearAll();
    if (this.unsubscribeEventBus) {
      this.unsubscribeEventBus();
      this.unsubscribeEventBus = null;
    }
  }
}

/**
 * Singleton Alert Service instance for global application use.
 */
export const alerts = new AlertService();

export default alerts;
