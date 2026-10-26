/**
 * @file audio.js
 * @description Audio Manager service utilizing the native Web Audio API for procedural
 * Halloween sound synthesis (shoot blast, reload clicks, spectral hit) and ambient gothic drone.
 * Design Patterns: Singleton Pattern, Observer (EventBus subscriber).
 * Standards: UK English (en-GB), Zero local persistence, Browser Autoplay compliance.
 */

import { eventBus } from '../utils/eventBus.js';

/**
 * Procedural Audio Manager and sound synthesiser.
 */
export class AudioManager {
  /**
   * Initialises the audio manager instance with safe fallbacks.
   */
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    /** @type {GainNode|null} */
    this.masterGain = null;
    /** @type {GainNode|null} */
    this.ambientGain = null;
    /** @type {Array<OscillatorNode>} */
    this.ambientOscillators = [];

    /** Master volume level (0.0 to 1.0) */
    this.volume = 0.7;
    /** Whether sound output is currently muted */
    this.isMutedState = false;
    /** Whether audio context has been initialised via user gesture */
    this.isInitialised = false;

    /** Subscriptions cleanup callbacks */
    this.unsubscribers = [];
  }

  /**
   * Returns whether Web Audio API is supported in the current environment.
   *
   * @returns {boolean} True if supported; false otherwise.
   */
  isSupported() {
    return typeof window !== 'undefined' && (
      typeof window.AudioContext !== 'undefined' ||
      typeof window.webkitAudioContext !== 'undefined'
    );
  }

  /**
   * Initialises the Web Audio context upon first user gesture,
   * configures master gain routing, and attaches EventBus listeners.
   *
   * @returns {boolean} True if initialisation succeeded.
   */
  initialise() {
    if (this.isInitialised && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return true;
    }

    if (!this.isSupported()) {
      return false;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();

      // Master output gain node
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMutedState ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Ambient track gain node
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      this.isInitialised = true;
      this.attachEventListeners();
      return true;
    } catch (err) {
      console.warn('[AudioManager] Failed to initialise AudioContext:', err);
      return false;
    }
  }

  /**
   * Attaches decoupled listeners to game events on the EventBus.
   */
  attachEventListeners() {
    if (!eventBus || typeof eventBus.subscribe !== 'function') return;

    // Discard any previous subscriptions
    this.detachEventListeners();

    this.unsubscribers.push(
      eventBus.subscribe('game:player-shoot', () => this.playShoot()),
      eventBus.subscribe('game:weapon-reload-start', () => this.playReloadStart()),
      eventBus.subscribe('game:weapon-reloaded', () => this.playReloadComplete()),
      eventBus.subscribe('game:projectile-hit', () => this.playHit()),
      eventBus.subscribe('game:player-hit', () => this.playPlayerDamage()),
      eventBus.subscribe('screamer:play-sound', () => this.playScreamer()),
      eventBus.subscribe('audio:toggle-mute', (data) => {
        if (data && typeof data.isMuted === 'boolean') {
          this.setMuted(data.isMuted);
        } else {
          this.toggleMute();
        }
      })
    );
  }

  /**
   * Detaches all EventBus subscriptions.
   */
  detachEventListeners() {
    for (const unsubscribe of this.unsubscribers) {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    }
    this.unsubscribers = [];
  }

  /**
   * Toggles the master mute state.
   *
   * @returns {boolean} Current muted state.
   */
  toggleMute() {
    return this.setMuted(!this.isMutedState);
  }

  /**
   * Sets master audio mute status.
   *
   * @param {boolean} muted - Whether audio should be muted.
   * @returns {boolean} Applied muted state.
   */
  setMuted(muted) {
    this.isMutedState = Boolean(muted);

    if (this.masterGain && this.ctx) {
      const targetGain = this.isMutedState ? 0 : this.volume;
      this.masterGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }

    return this.isMutedState;
  }

  /**
   * Retrieves whether audio output is currently muted.
   *
   * @returns {boolean}
   */
  isMuted() {
    return this.isMutedState;
  }

  /**
   * Generates a short white noise buffer for procedural explosions and clicks.
   *
   * @param {number} durationSeconds - Duration in seconds.
   * @returns {AudioBuffer|null} Synthesised audio buffer.
   */
  createNoiseBuffer(durationSeconds = 0.2) {
    if (!this.ctx) return null;

    const bufferSize = Math.floor(this.ctx.sampleRate * durationSeconds);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  /**
   * Synthesises a punchy gunpowder gunshot sound effect with exponential decay.
   */
  playShoot() {
    if (!this.ctx || !this.masterGain || this.isMutedState) return;

    const now = this.ctx.currentTime;

    // 1. Explosive noise transient
    const noiseBuffer = this.createNoiseBuffer(0.18);
    if (noiseBuffer) {
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(1400, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(180, now + 0.18);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.8, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noiseSource.start(now);
      noiseSource.stop(now + 0.18);
    }

    // 2. Resonant tonal body pulse
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.15);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.7, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Synthesises a metallic cylinder open/click sound for reload initiation.
   */
  playReloadStart() {
    if (!this.ctx || !this.masterGain || this.isMutedState) return;

    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Synthesises a dual crisp mechanical click for cylinder lock and reload completion.
   */
  playReloadComplete() {
    if (!this.ctx || !this.masterGain || this.isMutedState) return;

    const now = this.ctx.currentTime;

    [0, 0.07].forEach((delay) => {
      const clickTime = now + delay;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1900, clickTime);
      osc.frequency.exponentialRampToValueAtTime(950, clickTime + 0.04);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1500, clickTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.45, clickTime);
      gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.04);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(clickTime);
      osc.stop(clickTime + 0.04);
    });
  }

  /**
   * Synthesises a spectral impact thud sound for projectile hits.
   */
  playHit() {
    if (!this.ctx || !this.masterGain || this.isMutedState) return;

    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Synthesises a visceral impact thud and distorted rumble for player damage sustained in combat.
   */
  playPlayerDamage() {
    if (!this.ctx || !this.masterGain || this.isMutedState) return;

    try {
      const now = this.ctx.currentTime;
      const duration = 0.22;

      // Heavy visceral impact tone (140Hz downward sweep to 35Hz)
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + duration);

      // Lowpass muffling filter for concussive thud
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, now);
      filter.frequency.exponentialRampToValueAtTime(70, now + duration);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration);
    } catch (err) {
      console.warn('[AudioManager] Error playing player damage sound:', err);
    }
  }

  /**
   * Synthesises a high-intensity jumpscare screech and shock wave.
   * Layers a piercing descending shrieking oscillator, a dissonant tritone harmonic,
   * and a bandpass-filtered noise explosion burst to produce an intense, startling jumpscare SFX.
   */
  playScreamer() {
    if (!this.ctx || !this.masterGain || this.isMutedState) return;

    try {
      const now = this.ctx.currentTime;
      const duration = 1.1;

      // 1. Primary shrieking oscillator (Sawtooth sweep 3400Hz -> 480Hz)
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(3400, now);
      osc1.frequency.exponentialRampToValueAtTime(480, now + duration);

      const gain1 = this.ctx.createGain();
      gain1.gain.setValueAtTime(0.7, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc1.connect(gain1);
      gain1.connect(this.masterGain);

      // 2. Secondary dissonant oscillator (Square wave detuned to tritone 2550Hz -> 360Hz)
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(2550, now);
      osc2.frequency.exponentialRampToValueAtTime(360, now + duration);

      const gain2 = this.ctx.createGain();
      gain2.gain.setValueAtTime(0.5, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc2.connect(gain2);
      gain2.connect(this.masterGain);

      // 3. Explosive noise burst for visceral physical presence
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.45);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.Q.setValueAtTime(2.2, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.8, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      // Trigger playback
      osc1.start(now);
      osc1.stop(now + duration);

      osc2.start(now);
      osc2.stop(now + duration);

      noiseSource.start(now);
      noiseSource.stop(now + 0.45);
    } catch (err) {
      console.warn('[AudioManager] Error playing screamer sound:', err);
    }
  }

  /**
   * Starts a procedural ambient gothic drone loop (low bass drone with slow LFO filter sweep).
   */
  startAmbient() {
    if (!this.ctx || !this.ambientGain || this.ambientOscillators.length > 0) return;

    try {
      const now = this.ctx.currentTime;

      // Base drone oscillator 1 (55Hz / A1)
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(55, now);

      // Base drone oscillator 2 (detuned slightly to 58Hz for eerie binaural beating)
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(58, now);

      // Lowpass resonant filter with slow LFO modulation
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, now);
      filter.Q.setValueAtTime(4.0, now);

      // Slow LFO for breathing filter sweep (0.1 Hz)
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.10, now);

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(60, now);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(this.ambientGain);

      osc1.start(now);
      osc2.start(now);
      lfo.start(now);

      this.ambientOscillators = [osc1, osc2, lfo];
    } catch (err) {
      console.warn('[AudioManager] Error starting ambient drone:', err);
    }
  }

  /**
   * Stops procedural ambient drone playback.
   */
  stopAmbient() {
    for (const osc of this.ambientOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch (_) {}
    }
    this.ambientOscillators = [];
  }

  /**
   * Completely tears down audio manager, closing the AudioContext and disconnecting nodes.
   */
  destroy() {
    this.stopAmbient();
    this.detachEventListeners();

    if (this.ctx && typeof this.ctx.close === 'function') {
      this.ctx.close().catch(() => {});
    }

    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.isInitialised = false;
  }
}

/**
 * Singleton instance of AudioManager.
 */
export const audioService = new AudioManager();

export default audioService;
