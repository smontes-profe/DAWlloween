/**
 * @file config.js
 * @description Centralised application configuration for DAWlloween.
 * Defines Supabase connection settings, storage bucket names, database tables,
 * resilience retry thresholds, and diagnostic mock mode flags.
 * Follows UK English (en-GB) naming conventions and pedagogical standards.
 */

/**
 * Placeholder URL pattern used to identify uninitialised configuration.
 */
const PLACEHOLDER_URL = 'https://your-project.supabase.co';

/**
 * Placeholder anon key pattern.
 */
const PLACEHOLDER_ANON_KEY = 'your-anon-key-placeholder';

/**
 * Retrieves environment variables safely in both browser and headless test runners.
 *
 * @returns {Record<string, string|undefined>} Environment map or empty object.
 */
function getEnvironment() {
  if (typeof window !== 'undefined' && window.__ENV__) {
    return window.__ENV__;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env;
  }
  return {};
}

const env = getEnvironment();

/**
 * Core Supabase cloud persistence and resilience configuration.
 */
export const SUPABASE_CONFIG = {
  url: env.SUPABASE_URL || PLACEHOLDER_URL,
  anonKey: env.SUPABASE_ANON_KEY || PLACEHOLDER_ANON_KEY,
  storageBucket: 'reactions',
  tableName: 'hall_of_fame',
  maxRetries: 3,
  retryDelayMs: 2000,
  retryBackoffFactor: 1.5
};

/**
 * Administrator credentials for the Hall of Fame moderation panel (#admin).
 * Configurable via environment variables with safe educational defaults.
 */
export const ADMIN_CONFIG = {
  username: env.ADMIN_USERNAME || 'admin',
  password: env.ADMIN_PASSWORD || 'dawlloween2026'
};

/**
 * Core gameplay balance parameters and player survival configurations.
 */
export const GAME_CONFIG = {
  /** Maximum discrete Health Points (HP) for player survival */
  maxHp: 5,
  /** Initial discrete Health Points (HP) allocated to the player */
  initialHp: 5,
  /** Discrete Health Points lost per enemy contact */
  damagePerHit: 1
};

/**
 * Jumpscare, reaction recording, and gameplay climax timing configuration.
 * Modify `durationMs` here to adjust the jumpscare exposure, webcam recording duration,
 * and background game continuation simultaneously.
 */
export const SCREAMER_CONFIG = {
  /**
   * Total exposure duration of the jumpscare shock in milliseconds.
   * Both the webcam reaction recording and background minigame continuation match this value.
   * Default: 3000ms (3.0 seconds).
   */
  durationMs: 3500,

  /**
   * Time in seconds for the game to be in the jumpscare state.
   */
  timeForScare: 30,

  /**
   * Emergency safety fallback timeout in milliseconds.
   * Guarantees transition to #register even if network or video decoding completely stalls.
   */
  safetyFallbackTimeoutMs: 10000,

  /**
   * Threshold before engaging SVG fallback if video buffering takes too long in milliseconds.
   */
  bufferingFallbackThresholdMs: 3500
};

/**
 * Validates whether Supabase credentials have been explicitly configured with non-placeholder values.
 *
 * @param {typeof SUPABASE_CONFIG} [config=SUPABASE_CONFIG] - Configuration object to validate.
 * @returns {boolean} True if URL and anonKey are populated with legitimate non-placeholder strings.
 */
export function isSupabaseConfigured(config = SUPABASE_CONFIG) {
  if (!config || typeof config !== 'object') {
    return false;
  }

  const { url, anonKey } = config;

  if (!url || typeof url !== 'string' || url.trim() === '' || url === PLACEHOLDER_URL) {
    return false;
  }

  if (!anonKey || typeof anonKey !== 'string' || anonKey.trim() === '' || anonKey === PLACEHOLDER_ANON_KEY) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Determines whether mock persistence mode should be activated.
 * Returns true if mock mode is explicitly forced via global flags or if credentials are unconfigured.
 *
 * @param {typeof SUPABASE_CONFIG} [config=SUPABASE_CONFIG] - Configuration to evaluate.
 * @returns {boolean} True if client should operate in mock/offline mode.
 */
export function isMockMode(config = SUPABASE_CONFIG) {
  if (typeof window !== 'undefined' && window.__MOCK_SUPABASE__ === true) {
    return true;
  }
  if (typeof process !== 'undefined' && process.env && process.env.MOCK_SUPABASE === 'true') {
    return true;
  }
  return !isSupabaseConfigured(config);
}

export default SUPABASE_CONFIG;
