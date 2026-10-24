/**
 * @file storageUpload.test.js
 * @description Unit and integration tests for Supabase Storage media upload pipeline.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  SupabaseService,
  MockSupabaseClient,
  generateMediaFilename,
  dataUrlToBlob
} from '../src/services/supabase.js';
import { eventBus } from '../src/utils/eventBus.js';

describe('Storage Upload Pipeline Unit & Integration Tests (US3.2 / T5)', () => {
  let service;
  let mockClient;

  beforeEach(() => {
    mockClient = new MockSupabaseClient({
      url: 'https://test-dawlloween.supabase.co',
      anonKey: 'anon-test-key',
      storageBucket: 'reactions',
      maxRetries: 2,
      retryDelayMs: 20
    });

    service = new SupabaseService({
      client: mockClient,
      config: {
        url: 'https://test-dawlloween.supabase.co',
        anonKey: 'anon-test-key',
        storageBucket: 'reactions',
        maxRetries: 2,
        retryDelayMs: 20
      }
    });
  });

  it('should generate unique, collision-free media filenames with expected extensions', () => {
    const filenames = new Set();
    const count = 100;

    for (let i = 0; i < count; i++) {
      const nameWebm = generateMediaFilename('webm');
      assert.ok(nameWebm.startsWith('reaction_'));
      assert.ok(nameWebm.endsWith('.webm'));
      filenames.add(nameWebm);

      const nameWebp = generateMediaFilename('.webp');
      assert.ok(nameWebp.endsWith('.webp'));
      assert.ok(!nameWebp.endsWith('..webp'));
      filenames.add(nameWebp);
    }

    assert.equal(filenames.size, count * 2, 'All generated filenames must be unique');
  });

  it('should convert base64 Data URLs to in-memory Blobs accurately', () => {
    // 1x1 transparent WebP data URL
    const webpDataUrl = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
    const blob = dataUrlToBlob(webpDataUrl);

    assert.ok(blob, 'Blob must be created');
    assert.equal(blob.type, 'image/webp');
    assert.ok(blob.size > 0);

    // Corrupted URL formats should throw descriptive errors
    assert.throws(() => dataUrlToBlob(null), /Valid data URL/);
    assert.throws(() => dataUrlToBlob('invalid-data-url'), /Invalid data URL format/);
  });

  it('should upload in-memory WebM video Blob and resolve public URL', async () => {
    const videoBlob = {
      size: 250000,
      type: 'video/webm'
    };

    const res = await service.uploadReactionMedia(videoBlob, {
      mimeType: 'video/webm',
      useRetry: false
    });

    assert.ok(res.path.startsWith('reaction_'));
    assert.ok(res.path.endsWith('.webm'));
    assert.equal(res.bucket, 'reactions');
    assert.equal(
      res.publicUrl,
      `https://test-dawlloween.supabase.co/storage/v1/object/public/reactions/${res.path}`
    );

    // Verify stored item in mock storage
    const bucketData = mockClient.storageData.get('reactions');
    assert.ok(bucketData.has(res.path));
    const entry = bucketData.get(res.path);
    assert.equal(entry.options.contentType, 'video/webm');
  });

  it('should upload WebP photo Data URL fallback with inferred MIME and extension', async () => {
    const webpDataUrl = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';

    const res = await service.uploadReactionMedia(webpDataUrl, {
      useRetry: false
    });

    assert.ok(res.path.startsWith('reaction_'));
    assert.ok(res.path.endsWith('.webp'));
    assert.equal(res.bucket, 'reactions');
    assert.ok(res.publicUrl.includes(res.path));

    const bucketData = mockClient.storageData.get('reactions');
    const entry = bucketData.get(res.path);
    assert.equal(entry.options.contentType, 'image/webp');
  });

  it('should support custom filename and custom target bucket', async () => {
    const dummyBlob = { size: 1024, type: 'video/mp4' };

    const res = await service.uploadReactionMedia(dummyBlob, {
      filename: 'custom_scare_clip.mp4',
      bucket: 'custom_reactions',
      mimeType: 'video/mp4',
      useRetry: false
    });

    assert.equal(res.path, 'custom_scare_clip.mp4');
    assert.equal(res.bucket, 'custom_reactions');
    assert.ok(res.publicUrl.includes('custom_reactions/custom_scare_clip.mp4'));
  });

  it('should automatically recover from transient cloud storage failure via retry', async () => {
    let callCount = 0;
    // Intercept upload to simulate 1 transient failure before succeeding
    const originalUpload = mockClient.storage.from('reactions').upload;
    mockClient.storage.from = (bucket) => ({
      upload: async (path, file, options) => {
        callCount++;
        if (callCount === 1) {
          return { data: null, error: new Error('Temporary 503 Service Unavailable') };
        }
        return { data: { path }, error: null };
      },
      getPublicUrl: (path) => ({
        data: { publicUrl: `https://test-dawlloween.supabase.co/storage/v1/object/public/reactions/${path}` }
      })
    });

    const dummyBlob = { size: 1024, type: 'video/webm' };
    const res = await service.uploadReactionMedia(dummyBlob, {
      filename: 'retry_recovered.webm',
      useRetry: true
    });

    assert.equal(callCount, 2, 'Should succeed on second attempt');
    assert.equal(res.path, 'retry_recovered.webm');
  });

  it('should throw error and publish storage:error when storage upload permanently fails', async () => {
    mockClient._simulateUploadFailure = true;
    const errorEvents = [];
    const unsub = eventBus.subscribe('storage:error', (p) => errorEvents.push(p));

    const dummyBlob = { size: 1024, type: 'video/webm' };

    await assert.rejects(async () => {
      await service.uploadReactionMedia(dummyBlob, {
        filename: 'will_fail.webm',
        useRetry: true
      });
    }, /Simulated cloud storage failure/);

    unsub();
    assert.ok(errorEvents.length >= 1, 'Should emit storage:error event');
  });
});
