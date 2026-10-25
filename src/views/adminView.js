/**
 * @file adminView.js
 * @description Administrator Authentication & Moderation Access View for DAWlloween.
 * Provides an accessible login form in European Spanish (es-ES) for moderating Hall of Fame entries.
 * Operates strictly with in-memory authentication state (zero local persistence).
 * Standards: UK English (en-GB) code internals, natural European Spanish UI copy.
 */

import { adminAuth } from '../services/adminAuth.js';
import { alerts } from '../ui/alerts.js';

/**
 * AdminView component handling the administrator login interface and session lifecycle.
 */
export class AdminView {
  /**
   * Initialise AdminView with authentication service dependency.
   *
   * @param {Object} [options={}] - View configuration options.
   * @param {Object} [options.authService=adminAuth] - Authentication service.
   */
  constructor(options = {}) {
    this.authService = options.authService || adminAuth;
    this.container = null;
    this.boundSubmitHandler = null;
    this.boundLogoutHandler = null;
    this.boundNavHallHandler = null;
  }

  /**
   * Mounts the view within the host container element.
   *
   * @param {HTMLElement} container - Target container for mounting.
   */
  mount(container) {
    if (!container) {
      throw new Error('AdminView: Mount container must be provided.');
    }

    this.container = container;
    this.render();
  }

  /**
   * Renders either the active session dashboard or the login form based on in-memory auth state.
   */
  render() {
    if (!this.container) {
      return;
    }

    this.container.innerHTML = '';

    const rootSection = document.createElement('section');
    rootSection.className = 'admin-view container';
    rootSection.setAttribute('aria-labelledby', 'admin-title');

    if (this.authService.isAuthenticated()) {
      this.renderActiveSession(rootSection);
    } else {
      this.renderLoginForm(rootSection);
    }

    this.container.appendChild(rootSection);
  }

  /**
   * Renders the active administrator session controls.
   *
   * @param {HTMLElement} parentElement - Host element.
   */
  renderActiveSession(parentElement) {
    const card = document.createElement('div');
    card.className = 'admin-card panel-surface';

    const header = document.createElement('div');
    header.className = 'admin-card__header';

    const badge = document.createElement('div');
    badge.className = 'admin-badge';
    badge.textContent = '🛡️ Modo Administrador Activo';

    const title = document.createElement('h1');
    title.id = 'admin-title';
    title.className = 'text-display text-pumpkin';
    title.textContent = 'Panel de Moderación';

    const desc = document.createElement('p');
    desc.className = 'admin-card__description';
    const currentUser = this.authService.getUsername() || 'admin';
    desc.innerHTML = `Has iniciado sesión como <strong class="text-ghost">${currentUser}</strong>. Tienes permisos para eliminar fotos y vídeos inapropiados en el Hall of Fame.`;

    header.appendChild(badge);
    header.appendChild(title);
    header.appendChild(desc);

    const actions = document.createElement('div');
    actions.className = 'admin-card__actions';

    const hallBtn = document.createElement('button');
    hallBtn.type = 'button';
    hallBtn.id = 'admin-btn-hall';
    hallBtn.className = 'btn btn--primary';
    hallBtn.textContent = '🏆 Ir al Hall of Fame';

    this.boundNavHallHandler = () => {
      if (typeof window !== 'undefined') {
        window.location.hash = '#hall-of-fame';
      }
    };
    hallBtn.addEventListener('click', this.boundNavHallHandler);

    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.id = 'admin-btn-logout';
    logoutBtn.className = 'btn btn--secondary';
    logoutBtn.textContent = '🚪 Cerrar Sesión';

    this.boundLogoutHandler = () => {
      this.authService.logout();
      alerts.info('Sesión de administración cerrada.');
      this.render();
    };
    logoutBtn.addEventListener('click', this.boundLogoutHandler);

    actions.appendChild(hallBtn);
    actions.appendChild(logoutBtn);

    card.appendChild(header);
    card.appendChild(actions);
    parentElement.appendChild(card);
  }

  /**
   * Renders the accessible administrator login form in European Spanish.
   *
   * @param {HTMLElement} parentElement - Host element.
   */
  renderLoginForm(parentElement) {
    const card = document.createElement('div');
    card.className = 'admin-card panel-surface';

    const header = document.createElement('div');
    header.className = 'admin-card__header';

    const title = document.createElement('h1');
    title.id = 'admin-title';
    title.className = 'text-display text-pumpkin';
    title.textContent = 'Acceso de Moderación';

    const desc = document.createElement('p');
    desc.className = 'admin-card__description text-muted';
    desc.textContent = 'Acceso reservado para la gestión y moderación de vídeos y fotos en DAWlloween.';

    header.appendChild(title);
    header.appendChild(desc);

    const form = document.createElement('form');
    form.id = 'admin-login-form';
    form.className = 'admin-form';
    form.noValidate = true;

    // Username group
    const userGroup = document.createElement('div');
    userGroup.className = 'form-group';

    const userLabel = document.createElement('label');
    userLabel.htmlFor = 'admin-username';
    userLabel.className = 'form-label';
    userLabel.textContent = 'Usuario';

    const userInput = document.createElement('input');
    userInput.type = 'text';
    userInput.id = 'admin-username';
    userInput.name = 'username';
    userInput.className = 'form-input';
    userInput.placeholder = 'Nombre de usuario';
    userInput.required = true;
    userInput.autocomplete = 'username';

    userGroup.appendChild(userLabel);
    userGroup.appendChild(userInput);

    // Password group
    const passGroup = document.createElement('div');
    passGroup.className = 'form-group';

    const passLabel = document.createElement('label');
    passLabel.htmlFor = 'admin-password';
    passLabel.className = 'form-label';
    passLabel.textContent = 'Contraseña';

    const passInput = document.createElement('input');
    passInput.type = 'password';
    passInput.id = 'admin-password';
    passInput.name = 'password';
    passInput.className = 'form-input';
    passInput.placeholder = 'Contraseña de moderación';
    passInput.required = true;
    passInput.autocomplete = 'current-password';

    passGroup.appendChild(passLabel);
    passGroup.appendChild(passInput);

    // Feedback message region
    const feedback = document.createElement('div');
    feedback.id = 'admin-feedback';
    feedback.className = 'admin-feedback';
    feedback.setAttribute('role', 'alert');
    feedback.setAttribute('aria-live', 'polite');

    // Submit actions
    const actions = document.createElement('div');
    actions.className = 'admin-form__actions';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.id = 'admin-login-submit';
    submitBtn.className = 'btn btn--primary';
    submitBtn.textContent = '🔑 Iniciar Sesión';

    const cancelLink = document.createElement('a');
    cancelLink.href = '#home';
    cancelLink.className = 'btn btn--secondary';
    cancelLink.textContent = 'Cancelar';

    actions.appendChild(submitBtn);
    actions.appendChild(cancelLink);

    form.appendChild(userGroup);
    form.appendChild(passGroup);
    form.appendChild(feedback);
    form.appendChild(actions);

    this.boundSubmitHandler = (event) => {
      event.preventDefault();
      feedback.textContent = '';
      feedback.className = 'admin-feedback';

      const usernameVal = userInput.value.trim();
      const passwordVal = passInput.value.trim();

      if (!usernameVal || !passwordVal) {
        feedback.textContent = 'Por favor, introduce el usuario y la contraseña.';
        feedback.classList.add('admin-feedback--error');
        return;
      }

      const isSuccess = this.authService.login(usernameVal, passwordVal);

      if (isSuccess) {
        alerts.success('¡Sesión de moderación iniciada correctamente!');
        if (typeof window !== 'undefined') {
          window.location.hash = '#hall-of-fame';
        }
      } else {
        feedback.textContent = 'Credenciales incorrectas. Acceso denegado.';
        feedback.classList.add('admin-feedback--error');
        passInput.value = '';
        passInput.focus();
        alerts.error('Error de autenticación: usuario o contraseña incorrectos.');
      }
    };

    form.addEventListener('submit', this.boundSubmitHandler);

    card.appendChild(header);
    card.appendChild(form);
    parentElement.appendChild(card);
  }

  /**
   * Unmounts the view and cleans up active event listeners.
   */
  unmount() {
    if (this.container) {
      const form = this.container.querySelector('#admin-login-form');
      if (form && this.boundSubmitHandler) {
        form.removeEventListener('submit', this.boundSubmitHandler);
      }

      const logoutBtn = this.container.querySelector('#admin-btn-logout');
      if (logoutBtn && this.boundLogoutHandler) {
        logoutBtn.removeEventListener('click', this.boundLogoutHandler);
      }

      const hallBtn = this.container.querySelector('#admin-btn-hall');
      if (hallBtn && this.boundNavHallHandler) {
        hallBtn.removeEventListener('click', this.boundNavHallHandler);
      }

      this.container.innerHTML = '';
      this.container = null;
    }

    this.boundSubmitHandler = null;
    this.boundLogoutHandler = null;
    this.boundNavHallHandler = null;
  }
}

/**
 * Singleton AdminView instance for application-wide routing.
 */
export const adminView = new AdminView();

export default adminView;
