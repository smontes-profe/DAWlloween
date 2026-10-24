/**
 * @file config.test.js
 * @description Unit tests for application configuration module.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SUPABASE_CONFIG, isSupabaseConfigured, isMockMode } from '../src/config.js';

describe('Config Module Unit Tests', () => {
  it('should expose default SUPABASE_CONFIG with expected structure and keys', () => {
    assert.ok(SUPABASE_CONFIG, 'SUPABASE_CONFIG should be defined');
    assert.equal(typeof SUPABASE_CONFIG.url, 'string');
    assert.equal(typeof SUPABASE_CONFIG.anonKey, 'string');
    assert.equal(SUPABASE_CONFIG.storageBucket, 'reactions');
    assert.equal(SUPABASE_CONFIG.tableName, 'hall_of_fame');
    assert.equal(SUPABASE_CONFIG.maxRetries, 3);
    assert.equal(SUPABASE_CONFIG.retryDelayMs, 2000);
    assert.equal(SUPABASE_CONFIG.retryBackoffFactor, 1.5);
  });

  it('should correctly identify unconfigured or placeholder credentials', () => {
    // Default placeholder configuration
    const placeholderConfig = {
      url: 'https://your-project.supabase.co',
      anonKey: 'your-anon-key-placeholder'
    };
    assert.equal(isSupabaseConfigured(placeholderConfig), false);

    // Empty strings
    assert.equal(isSupabaseConfigured({ url: '', anonKey: '' }), false);

    // Missing keys
    assert.equal(isSupabaseConfigured({ url: 'https://xyz.supabase.co' }), false);
    assert.equal(isSupabaseConfigured({ anonKey: 'valid-key' }), false);

    // Invalid URL format
    assert.equal(isSupabaseConfigured({ url: 'not-a-valid-url', anonKey: 'some-key' }), false);
  });

  it('should return true for valid, configured Supabase credentials', () => {
    const validConfig = {
      url: 'https://dawlloween-project.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid-anon-key'
    };
    assert.equal(isSupabaseConfigured(validConfig), true);
  });

  it('should evaluate isMockMode correctly based on configuration', () => {
    const unconfigured = {
      url: 'https://your-project.supabase.co',
      anonKey: 'your-anon-key-placeholder'
    };
    assert.equal(isMockMode(unconfigured), true);

    const configured = {
      url: 'https://dawlloween-project.supabase.co',
      anonKey: 'valid-token'
    };
    assert.equal(isMockMode(configured), false);
  });
});
