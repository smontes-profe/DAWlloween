/**
 * @file welcomeView.js
 * @description Welcome View component for DAWlloween SPA.
 * Presents immersive horror storytelling, game controls overview,
 * and triggers webcam calibration before transitioning to the survival arena (#play).
 * Standards: UK English (en-GB), Accessible DOM (a11y), Zero local persistence.
 */

import { cameraService } from '../screamer/camera.js';
import { alerts } from '../ui/alerts.js';
import { audioService } from '../services/audio.js';
import { ScreamerView } from './screamerView.js';

/**
 * Welcome View component managing the landing screen lifecycle.
 */
export class WelcomeView {
  /**
   * Initialise the welcome view component.
   */
  constructor() {
    /** @type {HTMLElement|null} */
    this.rootElement = null;
    /** @type {HTMLButtonElement|null} */
    this.startButton = null;
    /** @type {boolean} */
    this.isCalibrating = false;
    /** @type {Function|null} */
    this.boundStartHandler = null;
  }

  /**
   * Build and mount the welcome view DOM structure into the specified container.
   *
   * @param {HTMLElement} container - The SPA host container (#app).
   */
  mount(container) {
    if (!container) {
      return;
    }

    const wrapper = document.createElement('section');
    wrapper.className = 'welcome-view container';
    wrapper.setAttribute('aria-labelledby', 'welcome-title');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = 'var(--space-xl)';
    wrapper.style.padding = 'var(--space-xl) var(--space-md)';

    // 1. Hero banner section
    const heroPanel = document.createElement('div');
    heroPanel.className = 'panel-surface';
    heroPanel.style.textAlign = 'center';
    heroPanel.style.display = 'flex';
    heroPanel.style.flexDirection = 'column';
    heroPanel.style.alignItems = 'center';
    heroPanel.style.gap = 'var(--space-sm)';

    const title = document.createElement('h1');
    title.id = 'welcome-title';
    title.className = 'text-display text-pumpkin flicker';
    title.style.fontSize = 'var(--font-size-hero)';
    title.style.lineHeight = '1.1';
    title.textContent = 'DAWlloween: Night of the Dead';

    const subtitle = document.createElement('p');
    subtitle.className = 'text-spectral';
    subtitle.style.fontSize = 'var(--font-size-h3)';
    subtitle.style.fontWeight = '600';
    subtitle.textContent = 'Desafío arcade nocturno de supervivencia 2D para estudiantes de DAW';

    const leadSynopsis = document.createElement('p');
    leadSynopsis.className = 'text-muted';
    leadSynopsis.style.maxWidth = '780px';
    leadSynopsis.style.margin = '0 auto';
    leadSynopsis.textContent =
      'Sobrevive a la horda espectral durante 60 segundos en la oscura arena. ¡Controla tu movimiento, gestiona tu revólver de 6 disparos, apunta con precisión y mantén la calma!';

    heroPanel.appendChild(title);
    heroPanel.appendChild(subtitle);
    heroPanel.appendChild(leadSynopsis);
    wrapper.appendChild(heroPanel);

    // 2. Mission briefings & controls grid
    const briefingGrid = document.createElement('div');
    briefingGrid.className = 'welcome-grid';
    briefingGrid.style.display = 'grid';
    briefingGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
    briefingGrid.style.gap = 'var(--space-lg)';

    // Card 1: Controls
    const controlsCard = this.createBriefingCard(
      '🕹️ Movimiento y Puntería',
      'Esquiva a los enemigos con las teclas WASD en 8 direcciones. Apunta continuamente con el cursor del ratón por la arena.'
    );

    // Card 2: Mechanics
    const combatCard = this.createBriefingCard(
      '🔫 Tambor de 6 Disparos',
      'Haz clic izquierdo para disparar proyectiles. Cada disparo consume una bala del tambor. Tras 6 disparos, se activa la recarga automática.'
    );

    // Card 3: Calibration
    const sensorCard = this.createBriefingCard(
      '👁️ Calibración de Cámara',
      'Se requiere calibrar la cámara web antes de entrar para registrar tu reacción en el Hall of Fame del aula. No se guardan datos localmente.'
    );

    briefingGrid.appendChild(controlsCard);
    briefingGrid.appendChild(combatCard);
    briefingGrid.appendChild(sensorCard);
    wrapper.appendChild(briefingGrid);

    // 3. Call to Action / Calibration section
    const ctaPanel = document.createElement('div');
    ctaPanel.className = 'panel-surface';
    ctaPanel.style.textAlign = 'center';
    ctaPanel.style.display = 'flex';
    ctaPanel.style.flexDirection = 'column';
    ctaPanel.style.alignItems = 'center';
    ctaPanel.style.gap = 'var(--space-md)';

    const startBtn = document.createElement('button');
    startBtn.id = 'btn-start-game';
    startBtn.type = 'button';
    startBtn.className = 'btn-arcade';
    startBtn.setAttribute('aria-label', 'Calibrar cámara web y comenzar partida');

    const btnIcon = document.createElement('span');
    btnIcon.setAttribute('aria-hidden', 'true');
    btnIcon.textContent = '🎃';

    const btnText = document.createElement('span');
    btnText.className = 'btn-arcade__text';
    btnText.textContent = 'Calibrar Cámara y Entrar';

    startBtn.appendChild(btnIcon);
    startBtn.appendChild(btnText);

    const privacyDisclaimer = document.createElement('p');
    privacyDisclaimer.className = 'text-muted';
    privacyDisclaimer.style.fontSize = 'var(--font-size-small)';
    privacyDisclaimer.textContent =
      'Nota de privacidad: La señal de la cámara se procesa exclusivamente en memoria durante la partida. Cero almacenamiento local.';

    ctaPanel.appendChild(startBtn);
    ctaPanel.appendChild(privacyDisclaimer);
    wrapper.appendChild(ctaPanel);

    // Attach click listener
    this.boundStartHandler = () => this.handleStartExperience();
    startBtn.addEventListener('click', this.boundStartHandler);

    this.rootElement = wrapper;
    this.startButton = startBtn;
    container.appendChild(wrapper);
  }

  /**
   * Helper to construct a semantic briefing card.
   *
   * @param {string} title - Card header with emoji.
   * @param {string} description - Briefing text.
   * @returns {HTMLElement} The card element.
   */
  createBriefingCard(title, description) {
    const card = document.createElement('div');
    card.className = 'card-surface card-surface--interactive';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = 'var(--space-xs)';

    const cardTitle = document.createElement('h3');
    cardTitle.style.fontSize = 'var(--font-size-h3)';
    cardTitle.style.color = 'var(--colour-pumpkin)';
    cardTitle.textContent = title;

    const cardDesc = document.createElement('p');
    cardDesc.style.fontSize = 'var(--font-size-body)';
    cardDesc.style.color = 'var(--colour-text-secondary)';
    cardDesc.textContent = description;

    card.appendChild(cardTitle);
    card.appendChild(cardDesc);
    return card;
  }

  /**
   * Handle user activation of the start button.
   * Requests webcam permissions, updates UI loading state, and redirects to #play upon success.
   *
   * @returns {Promise<boolean>} True if calibration succeeded and route transition was triggered.
   */
  async handleStartExperience() {
    if (this.isCalibrating || !this.startButton) {
      return false;
    }

    this.isCalibrating = true;
    this.startButton.disabled = true;
    this.startButton.setAttribute('aria-busy', 'true');

    const textSpan = this.startButton.querySelector('.btn-arcade__text');
    if (textSpan) {
      textSpan.textContent = 'Calibrando sensor...';
    }

    try {
      // Prime and unlock Web Audio API context during this user gesture to comply with browser autoplay policies
      if (audioService && typeof audioService.initialise === 'function') {
        audioService.initialise();
      }

      // Preload jumpscare video asset in advance
      if (typeof ScreamerView.preload === 'function') {
        ScreamerView.preload();
      }

      const result = await cameraService.requestPermission();

      if (result.success) {
        if (textSpan) {
          textSpan.textContent = '¡Sensor calibrado! Entrando...';
        }

        if (alerts && typeof alerts.success === 'function') {
          alerts.success('Cámara web calibrada correctamente. ¡Prepárate para sobrevivir!', 'Listo', 2500);
        }

        // Seamless transition to the game arena
        if (typeof window !== 'undefined') {
          window.location.hash = '#play';
        }

        return true;
      }

      // Handshake denied or failed
      this.resetButtonState('Calibrar Cámara y Entrar');
      return false;
    } catch (error) {
      console.error('[WelcomeView] Calibration error:', error);
      this.resetButtonState('Calibrar Cámara y Entrar');
      return false;
    } finally {
      this.isCalibrating = false;
    }
  }

  /**
   * Reset start button state after failed calibration or cancel.
   *
   * @param {string} label - Button label text.
   */
  resetButtonState(label) {
    if (!this.startButton) {
      return;
    }

    this.startButton.disabled = false;
    this.startButton.removeAttribute('aria-busy');
    const textSpan = this.startButton.querySelector('.btn-arcade__text');
    if (textSpan) {
      textSpan.textContent = label;
    }
  }

  /**
   * Clean up event listeners and DOM elements upon view unmount.
   */
  unmount() {
    if (this.startButton && this.boundStartHandler) {
      this.startButton.removeEventListener('click', this.boundStartHandler);
      this.boundStartHandler = null;
    }

    if (this.rootElement && this.rootElement.parentNode) {
      this.rootElement.parentNode.removeChild(this.rootElement);
    }

    this.rootElement = null;
    this.startButton = null;
    this.isCalibrating = false;
  }
}

/**
 * Singleton instance of WelcomeView for SPA usage.
 */
export const welcomeView = new WelcomeView();

export default welcomeView;
