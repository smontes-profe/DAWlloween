/**
 * @file supabase.test.js
 * @description Unit tests for SupabaseService and MockSupabaseClient.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseService, MockSupabaseClient, SERVICE_STATUS, supabaseService } from '../src/services/supabase.js';

describe('SupabaseService Unit Tests (US3.1 / T1)', () => {
  beforeEach(() => {
    supabaseService.reset();
  });

  it('should initialise MockSupabaseClient with working in-memory storage upload and public URL', async () => {
    const mockClient = new MockSupabaseClient({
      url: 'https://test-project.supabase.co',
      anonKey: 'test-key'
    });

    const fakeBlob = { size: 1024, type: 'video/webm' };
    const uploadRes = await mockClient.storage.from('reactions').upload('reaction_123.webm', fakeBlob);

    assert.equal(uploadRes.error, null);
    assert.deepEqual(uploadRes.data, { path: 'reaction_123.webm' });

    const urlRes = mockClient.storage.from('reactions').getPublicUrl('reaction_123.webm');
    assert.equal(
      urlRes.data.publicUrl,
      'https://test-project.supabase.co/storage/v1/object/public/reactions/reaction_123.webm'
    );
  });

  it('should support in-memory table insertion and select in MockSupabaseClient', async () => {
    const mockClient = new MockSupabaseClient({
      url: 'https://test-project.supabase.co',
      anonKey: 'test-key'
    });

    const record = {
      nickname: 'GhostHunter',
      video_url: 'https://test-project.supabase.co/storage/v1/object/public/reactions/vid.webm',
      photo_url: 'https://test-project.supabase.co/storage/v1/object/public/reactions/pic.webp'
    };

    const insertRes = await mockClient.from('hall_of_fame').insert(record).select();
    assert.equal(insertRes.error, null);
    assert.ok(Array.isArray(insertRes.data));
    assert.equal(insertRes.data.length, 1);
    assert.equal(insertRes.data[0].nickname, 'GhostHunter');
    assert.ok(insertRes.data[0].id, 'Should generate an id');
    assert.ok(insertRes.data[0].created_at, 'Should generate a created_at timestamp');
  });

  it('should automatically fall back to MockSupabaseClient when credentials are placeholders', async () => {
    const service = new SupabaseService({
      config: {
        url: 'https://your-project.supabase.co',
        anonKey: 'your-anon-key-placeholder',
        tableName: 'hall_of_fame',
        storageBucket: 'reactions'
      }
    });

    assert.equal(service.status, SERVICE_STATUS.UNINITIALISED);
    const client = await service.initialise();

    assert.ok(client instanceof MockSupabaseClient);
    assert.equal(service.status, SERVICE_STATUS.MOCK);
    assert.equal(service.isMock(), true);
  });

  it('should allow custom client injection for deterministic tests', async () => {
    const customMock = {
      isCustom: true,
      storage: {},
      from: () => {}
    };

    const service = new SupabaseService({ client: customMock });
    const resolvedClient = await service.getClient();

    assert.equal(resolvedClient.isCustom, true);
    assert.equal(service.status, SERVICE_STATUS.INITIALISED);
  });

  it('should invoke clientFactory when provided with valid credentials', async () => {
    let factoryCalled = false;
    const dummyClient = { id: 'factory-created' };

    const service = new SupabaseService({
      config: {
        url: 'https://valid-project.supabase.co',
        anonKey: 'valid-anon-key'
      },
      clientFactory: (url, key) => {
        factoryCalled = true;
        assert.equal(url, 'https://valid-project.supabase.co');
        assert.equal(key, 'valid-anon-key');
        return dummyClient;
      }
    });

    const client = await service.initialise();
    assert.equal(factoryCalled, true);
    assert.equal(client.id, 'factory-created');
    assert.equal(service.status, SERVICE_STATUS.INITIALISED);
  });

  it('should return healthy diagnostic status in mock mode', async () => {
    const service = new SupabaseService();
    const health = await service.checkHealth();

    assert.equal(health.ok, true);
    assert.equal(health.status, 'MOCK_HEALTHY');
  });

  it('should reset service state cleanly on reset()', async () => {
    const service = new SupabaseService();
    await service.initialise();
    assert.equal(service.status, SERVICE_STATUS.MOCK);

    service.reset();
    assert.equal(service.status, SERVICE_STATUS.UNINITIALISED);
    assert.equal(service.client, null);
  });
});
