/**
 * @file adminAuth.js
 * @description In-memory administrator authentication service for DAWlloween.
 * Enforces zero local persistence (no localStorage, sessionStorage, or cookies).
 * Authenticates against credentials configured in ADMIN_CONFIG and publishes session events.
 * Standards: UK English (en-GB) naming and pedagogical design patterns.
 */

import { ADMIN_CONFIG } from '../config.js';
import { eventBus } from '../utils/eventBus.js';

/**
 * Service managing in-memory administrator session lifecycle.
 */
export class AdminAuthService {
  /**
   * Initialise in-memory authentication state.
   *
   * @param {Object} [config=ADMIN_CONFIG] - Credentials configuration.
   */
  constructor(config = ADMIN_CONFIG) {
    this.config = config;
    this._isAuthenticated = false;
    this._authenticatedUser = null;
  }

  /**
   * Validates submitted credentials and establishes an in-memory session.
   *
   * @param {string} username - Submitted administrator username.
   * @param {string} password - Submitted administrator password.
   * @returns {boolean} True if credentials match; false otherwise.
   */
  login(username, password) {
    if (!username || !password) {
      eventBus.publish('admin:login-failed', {
        reason: 'EMPTY_CREDENTIALS',
        timestamp: new Date().toISOString()
      });
      return false;
    }

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    const expectedUser = this.config.username || 'admin';
    const expectedPass = this.config.password || 'dawlloween2026';

    if (cleanUsername === expectedUser && cleanPassword === expectedPass) {
      this._isAuthenticated = true;
      this._authenticatedUser = cleanUsername;

      eventBus.publish('admin:login-success', {
        username: cleanUsername,
        timestamp: new Date().toISOString()
      });

      return true;
    }

    eventBus.publish('admin:login-failed', {
      reason: 'INVALID_CREDENTIALS',
      attemptedUser: cleanUsername,
      timestamp: new Date().toISOString()
    });

    return false;
  }

  /**
   * Terminates the current in-memory administrator session.
   */
  logout() {
    if (!this._isAuthenticated) {
      return;
    }

    const previousUser = this._authenticatedUser;
    this._isAuthenticated = false;
    this._authenticatedUser = null;

    eventBus.publish('admin:logged-out', {
      username: previousUser,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Checks whether an administrator session is currently active.
   *
   * @returns {boolean} True if authenticated.
   */
  isAuthenticated() {
    return this._isAuthenticated;
  }

  /**
   * Retrieves the currently authenticated username.
   *
   * @returns {string|null} Username or null if unauthenticated.
   */
  getUsername() {
    return this._authenticatedUser;
  }

  /**
   * Resets authentication state strictly for test isolation.
   */
  reset() {
    this._isAuthenticated = false;
    this._authenticatedUser = null;
  }
}

/**
 * Application-wide singleton administrator authentication service.
 */
export const adminAuth = new AdminAuthService();

export default adminAuth;
