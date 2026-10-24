/**
 * @file supabase.js
 * @description Cloud persistence service interfacing with Supabase BaaS.
 * Provides client initialisation, connection diagnostics, and an in-memory mock client
 * for offline development and testing, maintaining zero local persistence.
 * Standards: Vanilla JavaScript (ES Modules), UK English (en-GB).
 */

import { SUPABASE_CONFIG, isSupabaseConfigured, isMockMode } from '../config.js';
import { eventBus } from '../utils/eventBus.js';

/**
 * Service status enumeration.
 */
export const SERVICE_STATUS = {
  UNINITIALISED: 'UNINITIALISED',
  INITIALISED: 'INITIALISED',
  MOCK: 'MOCK',
  ERROR: 'ERROR'
};

/**
 * In-memory Mock Supabase Client for headless unit testing and offline development.
 */
export class MockSupabaseClient {
  constructor(config = SUPABASE_CONFIG) {
    this.config = config;
    this.storageData = new Map();
    this.tableData = new Map();
  }

  /**
   * Mock storage interface.
   *
   * @param {string} bucket - Storage bucket name.
   */
  storage = {
    from: (bucket) => ({
      upload: async (path, file, options = {}) => {
        if (!path || !file) {
          return { data: null, error: new Error('Path and file are required for upload.') };
        }
        if (this._simulateUploadFailure) {
          return { data: null, error: new Error('Simulated cloud storage failure.') };
        }
        const bucketMap = this.storageData.get(bucket) || new Map();
        bucketMap.set(path, { file, options, uploadedAt: new Date().toISOString() });
        this.storageData.set(bucket, bucketMap);
        return { data: { path }, error: null };
      },
      getPublicUrl: (path) => {
        const baseUrl = this.config.url.replace(/\/+$/, '');
        return {
          data: {
            publicUrl: `${baseUrl}/storage/v1/object/public/${bucket}/${path}`
          }
        };
      }
    })
  };

  /**
   * Mock database table interface.
   *
   * @param {string} tableName - Target table.
   */
  from(tableName) {
    return {
      insert: (records) => {
        const rows = Array.isArray(records) ? records : [records];
        return {
          select: async () => {
            if (this._simulateDbFailure) {
              return { data: null, error: new Error('Simulated database insertion failure.') };
            }
            const tableList = this.tableData.get(tableName) || [];
            const savedRows = rows.map((r) => ({
              id: r.id || `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              created_at: r.created_at || new Date().toISOString(),
              ...r
            }));
            this.tableData.set(tableName, [...tableList, ...savedRows]);
            return { data: savedRows, error: null };
          }
        };
      },
      select: () => ({
        order: () => async () => {
          const list = this.tableData.get(tableName) || [];
          return { data: list, error: null };
        }
      })
    };
  }

  /**
   * Clears in-memory test state.
   */
  clear() {
    this.storageData.clear();
    this.tableData.clear();
    this._simulateUploadFailure = false;
    this._simulateDbFailure = false;
  }
}

/**
 * Modular Supabase Cloud Persistence Service.
 */
export class SupabaseService {
  /**
   * @param {Object} [options={}] - Service configuration options.
   * @param {Object} [options.client] - Pre-instantiated Supabase client instance.
   * @param {Function} [options.clientFactory] - Factory function to instantiate client `(url, anonKey) => client`.
   * @param {typeof SUPABASE_CONFIG} [options.config=SUPABASE_CONFIG] - Credentials and config.
   */
  constructor(options = {}) {
    this.config = options.config || SUPABASE_CONFIG;
    this.client = options.client || null;
    this.clientFactory = options.clientFactory || null;
    this.status = SERVICE_STATUS.UNINITIALISED;
    this._isMockInstance = false;
  }

  /**
   * Initialises the Supabase client connection or mock fallback.
   *
   * @returns {Promise<Object>} The resolved client instance.
   */
  async initialise() {
    if (this.client) {
      this.status = this._isMockInstance ? SERVICE_STATUS.MOCK : SERVICE_STATUS.INITIALISED;
      return this.client;
    }

    // Check if mock mode is forced or credentials are uninitialised
    if (isMockMode(this.config)) {
      this.client = new MockSupabaseClient(this.config);
      this.status = SERVICE_STATUS.MOCK;
      this._isMockInstance = true;
      return this.client;
    }

    // Try custom client factory if provided
    if (typeof this.clientFactory === 'function') {
      try {
        this.client = this.clientFactory(this.config.url, this.config.anonKey);
        this.status = SERVICE_STATUS.INITIALISED;
        return this.client;
      } catch (err) {
        this.status = SERVICE_STATUS.ERROR;
        throw new Error(`Failed to initialise Supabase client via custom factory: ${err.message}`);
      }
    }

    // Try global window.supabase if loaded via script tag
    if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
      this.client = window.supabase.createClient(this.config.url, this.config.anonKey);
      this.status = SERVICE_STATUS.INITIALISED;
      return this.client;
    }

    // In modern browser runtime, dynamically import from CDN ESM
    if (typeof window !== 'undefined') {
      try {
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        this.client = createClient(this.config.url, this.config.anonKey);
        this.status = SERVICE_STATUS.INITIALISED;
        return this.client;
      } catch (importErr) {
        console.warn('Could not import remote Supabase ESM; falling back to MockSupabaseClient.', importErr);
        this.client = new MockSupabaseClient(this.config);
        this.status = SERVICE_STATUS.MOCK;
        this._isMockInstance = true;
        return this.client;
      }
    }

    // Fallback for headless testing environments without window
    this.client = new MockSupabaseClient(this.config);
    this.status = SERVICE_STATUS.MOCK;
    this._isMockInstance = true;
    return this.client;
  }

  /**
   * Retrieves the active Supabase client instance, initialising if necessary.
   *
   * @returns {Promise<Object>}
   */
  async getClient() {
    if (!this.client || this.status === SERVICE_STATUS.UNINITIALISED) {
      await this.initialise();
    }
    return this.client;
  }

  /**
   * Checks whether the service is running in mock/offline mode.
   *
   * @returns {boolean}
   */
  isMock() {
    return this._isMockInstance || this.status === SERVICE_STATUS.MOCK;
  }

  /**
   * Performs a lightweight connection and health diagnostic check.
   *
   * @returns {Promise<{ ok: boolean, status: string, error?: string }>}
   */
  async checkHealth() {
    try {
      const client = await this.getClient();
      if (!client) {
        return { ok: false, status: this.status, error: 'Client uninitialised' };
      }

      if (this.isMock()) {
        return { ok: true, status: 'MOCK_HEALTHY' };
      }

      // Quick diagnostic query to table
      const { error } = await client
        .from(this.config.tableName)
        .select('id')
        .limit(1);

      if (error) {
        return { ok: false, status: 'CLOUD_ERROR', error: error.message };
      }

      return { ok: true, status: 'CONNECTED' };
    } catch (err) {
      return { ok: false, status: 'NETWORK_ERROR', error: err.message };
    }
  }

  /**
   * Resets the service state for isolated test execution.
   */
  reset() {
    if (this.client && typeof this.client.clear === 'function') {
      this.client.clear();
    }
    this.client = null;
    this.status = SERVICE_STATUS.UNINITIALISED;
    this._isMockInstance = false;
  }
}

/**
 * Singleton SupabaseService instance for application-wide persistence operations.
 */
export const supabaseService = new SupabaseService();

export default supabaseService;
