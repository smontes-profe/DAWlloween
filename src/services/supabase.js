/**
 * @file supabase.js
 * @description Cloud persistence service interfacing with Supabase BaaS.
 * Provides client initialisation, connection diagnostics, and an in-memory mock client
 * for offline development and testing, maintaining zero local persistence.
 * Standards: Vanilla JavaScript (ES Modules), UK English (en-GB).
 */

import { SUPABASE_CONFIG, isSupabaseConfigured, isMockMode } from '../config.js';
import { eventBus } from '../utils/eventBus.js';
import { withRetry } from '../utils/retry.js';

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
      },
      remove: async (paths) => {
        if (this._simulateRemoveFailure) {
          return { data: null, error: new Error('Simulated cloud storage removal failure.') };
        }
        const bucketMap = this.storageData.get(bucket);
        const removed = [];
        if (bucketMap) {
          const list = Array.isArray(paths) ? paths : [paths];
          for (const p of list) {
            if (bucketMap.delete(p)) {
              removed.push({ name: p });
            }
          }
        }
        return { data: removed, error: null };
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
      }),
      delete: () => ({
        eq: (column, value) => {
          if (this._simulateDbFailure) {
            const errRes = { data: null, error: new Error('Simulated database deletion failure.') };
            return {
              select: async () => errRes,
              then: (resolve, reject) => Promise.resolve(errRes).then(resolve, reject)
            };
          }
          const tableList = this.tableData.get(tableName) || [];
          const remaining = tableList.filter((row) => row[column] !== value);
          const deleted = tableList.filter((row) => row[column] === value);
          this.tableData.set(tableName, remaining);
          const result = { data: deleted, error: null };
          return {
            select: async () => result,
            then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
          };
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
    this._simulateRemoveFailure = false;
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
   * Uploads an in-memory reaction video Blob or photo snapshot to Supabase Storage.
   * Leverages automatic exponential retry resilience.
   *
   * @param {Blob|string|Object} mediaData - Video/Photo Blob or base64 Data URL.
   * @param {Object} [options={}] - Upload options.
   * @param {string} [options.mimeType] - MIME type (e.g. 'video/webm', 'image/webp').
   * @param {string} [options.filename] - Custom filename override.
   * @param {string} [options.bucket] - Target storage bucket override.
   * @param {boolean} [options.useRetry=true] - Whether to wrap in exponential retry.
   * @returns {Promise<{ path: string, publicUrl: string, bucket: string }>}
   */
  async uploadReactionMedia(mediaData, options = {}) {
    if (!mediaData) {
      throw new Error('Media data (Blob or Data URL) is required for upload.');
    }

    const bucket = options.bucket || this.config.storageBucket || 'reactions';
    const useRetry = options.useRetry !== false;

    // Convert Data URL to in-memory Blob if needed
    let uploadBlob = mediaData;
    let inferredMime = options.mimeType;

    if (typeof mediaData === 'string' && mediaData.startsWith('data:')) {
      uploadBlob = dataUrlToBlob(mediaData);
      if (!inferredMime) {
        inferredMime = uploadBlob.type;
      }
    } else if (mediaData && mediaData.type && !inferredMime) {
      inferredMime = mediaData.type;
    }

    // Determine extension from MIME type
    let extension = 'webm';
    if (inferredMime) {
      if (inferredMime.includes('webp')) extension = 'webp';
      else if (inferredMime.includes('jpeg') || inferredMime.includes('jpg')) extension = 'jpg';
      else if (inferredMime.includes('mp4')) extension = 'mp4';
      else if (inferredMime.includes('webm')) extension = 'webm';
    }

    const filename = options.filename || generateMediaFilename(extension);
    const client = await this.getClient();

    const uploadOperation = async () => {
      const { data, error } = await client.storage
        .from(bucket)
        .upload(filename, uploadBlob, {
          contentType: inferredMime || 'application/octet-stream',
          upsert: false
        });

      if (error) {
        throw new Error(`Supabase Storage upload failed: ${error.message}`);
      }

      const { data: urlData } = client.storage.from(bucket).getPublicUrl(data.path || filename);
      const publicUrl = urlData?.publicUrl || '';

      return {
        path: data.path || filename,
        publicUrl,
        bucket
      };
    };

    if (useRetry) {
      return await withRetry(uploadOperation, {
        maxRetries: this.config.maxRetries || 3,
        initialDelayMs: this.config.retryDelayMs || 2000,
        backoffFactor: this.config.retryBackoffFactor || 1.5
      });
    }

    return await uploadOperation();
  }

  /**
   * Inserts a player reaction record into the `hall_of_fame` database table.
   * Leverages automatic exponential retry resilience.
   *
   * @param {Object} record - Reaction entry data.
   * @param {string} record.nickname - Player nickname (sanitised, non-empty).
   * @param {string|null} [record.videoUrl=null] - Public URL to reaction video clip in storage.
   * @param {string|null} [record.photoUrl=null] - Public URL to fallback reaction photo in storage.
   * @param {Object} [options={}] - Insertion options.
   * @param {string} [options.tableName] - Custom table name override.
   * @param {boolean} [options.useRetry=true] - Whether to wrap operation in exponential retry.
   * @param {number} [options.maxRetries] - Max retry attempts override.
   * @param {number} [options.retryDelayMs] - Initial delay override.
   * @returns {Promise<Object>} The persisted record including generated id and timestamp.
   */
  async insertReactionRecord({ nickname, videoUrl = null, photoUrl = null }, options = {}) {
    if (!nickname || typeof nickname !== 'string' || nickname.trim() === '') {
      throw new Error('A valid player nickname is required.');
    }

    const cleanNickname = nickname.trim().slice(0, 30);

    if (!videoUrl && !photoUrl) {
      throw new Error('At least one media reference (videoUrl or photoUrl) is required.');
    }

    const tableName = options.tableName || this.config.tableName || 'hall_of_fame';
    const useRetry = options.useRetry !== false;
    const client = await this.getClient();

    const insertPayload = {
      nickname: cleanNickname,
      video_url: videoUrl || null,
      photo_url: photoUrl || null,
      created_at: new Date().toISOString()
    };

    const insertOperation = async () => {
      const { data, error } = await client
        .from(tableName)
        .insert(insertPayload)
        .select();

      if (error) {
        throw new Error(`Supabase Database insertion failed: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('Supabase Database returned empty response after insertion.');
      }

      return data[0];
    };

    if (useRetry) {
      return await withRetry(insertOperation, {
        maxRetries: options.maxRetries || this.config.maxRetries || 3,
        initialDelayMs: options.retryDelayMs || this.config.retryDelayMs || 2000,
        backoffFactor: options.retryBackoffFactor || this.config.retryBackoffFactor || 1.5
      });
    }

    return await insertOperation();
  }

  /**
   * Retrieves player reaction records from the `hall_of_fame` table.
   *
   * @param {Object} [options={}] - Query options.
   * @param {string} [options.tableName] - Custom table name override.
   * @returns {Promise<Array<Object>>} List of reaction records.
   */
  async fetchHallOfFame(options = {}) {
    const tableName = options.tableName || this.config.tableName || 'hall_of_fame';
    const client = await this.getClient();

    const result = client.from(tableName).select('*');
    if (result && typeof result.order === 'function') {
      const orderFn = result.order('created_at', { ascending: false });
      const { data, error } = typeof orderFn === 'function' ? await orderFn() : await orderFn;
      if (error) {
        throw new Error(`Failed to fetch Hall of Fame records: ${error.message}`);
      }
      return data || [];
    }

    const { data, error } = await result;
    if (error) {
      throw new Error(`Failed to fetch Hall of Fame records: ${error.message}`);
    }
    return data || [];
  }

  /**
   * Deletes one or more media files from Supabase Storage bucket.
   * Leverages automatic exponential retry resilience.
   *
   * @param {string|Array<string>} filePaths - File path(s) within the bucket.
   * @param {Object} [options={}] - Options.
   * @param {string} [options.bucket] - Storage bucket override (default: config.storageBucket || 'reactions').
   * @param {boolean} [options.useRetry=true] - Whether to use retry mechanism.
   * @param {number} [options.maxRetries] - Max retry attempts override.
   * @param {number} [options.retryDelayMs] - Initial delay override.
   * @returns {Promise<Array<Object>>} List of successfully deleted path records.
   */
  async deleteReactionMedia(filePaths, options = {}) {
    const rawPaths = Array.isArray(filePaths) ? filePaths : [filePaths];
    const validPaths = rawPaths.filter((p) => typeof p === 'string' && p.trim() !== '');

    if (validPaths.length === 0) {
      return [];
    }

    const bucket = options.bucket || this.config.storageBucket || 'reactions';
    const useRetry = options.useRetry !== false;
    const client = await this.getClient();

    const removeOperation = async () => {
      const { data, error } = await client.storage.from(bucket).remove(validPaths);
      if (error) {
        throw new Error(`Supabase Storage file removal failed: ${error.message}`);
      }
      return data || [];
    };

    if (useRetry) {
      return await withRetry(removeOperation, {
        maxRetries: options.maxRetries || this.config.maxRetries || 3,
        initialDelayMs: options.retryDelayMs || this.config.retryDelayMs || 2000,
        backoffFactor: options.retryBackoffFactor || this.config.retryBackoffFactor || 1.5
      });
    }

    return await removeOperation();
  }

  /**
   * Permanently deletes a reaction record from the database and purges associated media
   * assets from Supabase Storage bucket. Emits `hall-of-fame:record-deleted` on success.
   * Fault-tolerant: if storage asset purge fails (e.g. file missing), deletion of database
   * row still proceeds to prevent orphaned/blocked moderation states.
   *
   * @param {string|number} id - Record ID to delete.
   * @param {Object} [mediaRefs={}] - Media URLs or paths to clean up.
   * @param {string|null} [mediaRefs.videoUrl] - Video public URL or storage path.
   * @param {string|null} [mediaRefs.photoUrl] - Photo public URL or storage path.
   * @param {Object} [options={}] - Options.
   * @param {string} [options.tableName] - Custom table name override.
   * @param {string} [options.bucket] - Custom bucket name override.
   * @param {boolean} [options.useRetry=true] - Whether to use retry mechanism for database delete.
   * @returns {Promise<{ id: string|number, storageDeleted: Array<Object>, storageErrors: Array<Error> }>} Result summary.
   */
  async deleteReactionRecord(id, { videoUrl = null, photoUrl = null } = {}, options = {}) {
    if (!id && id !== 0) {
      throw new Error('A valid record ID is required for deletion.');
    }

    const tableName = options.tableName || this.config.tableName || 'hall_of_fame';
    const bucket = options.bucket || this.config.storageBucket || 'reactions';
    const client = await this.getClient();

    // 1. Resolve and purge storage assets if paths exist
    const storagePaths = [];
    if (videoUrl) {
      const vPath = extractStoragePath(videoUrl, bucket);
      if (vPath) storagePaths.push(vPath);
    }
    if (photoUrl) {
      const pPath = extractStoragePath(photoUrl, bucket);
      if (pPath) storagePaths.push(pPath);
    }

    let storageDeleted = [];
    const storageErrors = [];

    if (storagePaths.length > 0) {
      try {
        storageDeleted = await this.deleteReactionMedia(storagePaths, {
          bucket,
          useRetry: options.useRetry !== false
        });
      } catch (err) {
        console.warn(`[SupabaseService] Non-fatal storage asset deletion error for record ${id}:`, err);
        storageErrors.push(err);
      }
    }

    // 2. Delete database row with retry resilience
    const deleteOperation = async () => {
      const { data, error } = await client
        .from(tableName)
        .delete()
        .eq('id', id)
        .select();

      if (error) {
        throw new Error(`Supabase Database row deletion failed: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error(`Supabase Database row deletion failed: 0 rows affected for ID "${id}". Ensure record exists and RLS DELETE policy is granted.`);
      }

      return data;
    };

    if (options.useRetry !== false) {
      await withRetry(deleteOperation, {
        maxRetries: options.maxRetries || this.config.maxRetries || 3,
        initialDelayMs: options.retryDelayMs || this.config.retryDelayMs || 2000,
        backoffFactor: options.retryBackoffFactor || this.config.retryBackoffFactor || 1.5
      });
    } else {
      await deleteOperation();
    }

    // 3. Publish reactive event via EventBus
    eventBus.publish('hall-of-fame:record-deleted', {
      id,
      videoUrl,
      photoUrl,
      deletedAt: new Date().toISOString()
    });

    return {
      id,
      storageDeleted,
      storageErrors
    };
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
 * Generates an collision-free media object key for storage.
 *
 * @param {string} [extension='webm'] - File extension.
 * @returns {string} Unique file name.
 */
export function generateMediaFilename(extension = 'webm') {
  const cleanExt = extension.replace(/^\.+/, '');
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  return `reaction_${timestamp}_${randomSuffix}.${cleanExt}`;
}

/**
 * Converts a base64 Data URL to an in-memory binary Blob strictly without local storage.
 *
 * @param {string} dataUrl - Data URL string.
 * @returns {Blob|Object} In-memory binary representation.
 */
export function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('Valid data URL string is required.');
  }

  const parts = dataUrl.split(',');
  if (parts.length < 2) {
    throw new Error('Invalid data URL format.');
  }

  const mimeMatch = parts[0].match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const base64Data = parts[1];

  let binaryString;
  if (typeof atob === 'function') {
    try {
      binaryString = atob(base64Data);
    } catch {
      if (typeof Buffer !== 'undefined') {
        binaryString = Buffer.from(base64Data, 'base64').toString('binary');
      } else {
        binaryString = base64Data;
      }
    }
  } else if (typeof Buffer !== 'undefined') {
    binaryString = Buffer.from(base64Data, 'base64').toString('binary');
  } else {
    binaryString = base64Data;
  }

  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  if (typeof Blob !== 'undefined') {
    return new Blob([bytes], { type: mimeType });
  }

  return {
    size: bytes.length,
    type: mimeType,
    arrayBuffer: async () => bytes.buffer
  };
}

/**
 * Extracts the storage object path relative to the given bucket from a full Supabase URL or raw path.
 *
 * @param {string|null} mediaUrl - Full public URL or raw object key.
 * @param {string} [bucket='reactions'] - Target storage bucket name.
 * @returns {string|null} Extracted object path or null if invalid.
 */
export function extractStoragePath(mediaUrl, bucket = 'reactions') {
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    return null;
  }

  const cleanUrl = mediaUrl.trim();
  const pattern = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`);
  const match = cleanUrl.match(pattern);

  if (match && match[1]) {
    return decodeURIComponent(match[1].split('?')[0]);
  }

  // If already a relative path / filename
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    return cleanUrl;
  }

  // Fallback: extract last segment if full external URL
  const parts = cleanUrl.split('?')[0].split('/');
  return parts[parts.length - 1] || null;
}

/**
 * Singleton SupabaseService instance for application-wide persistence operations.
 */
export const supabaseService = new SupabaseService();

export default supabaseService;
