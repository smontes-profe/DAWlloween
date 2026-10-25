/**
 * @file supabaseAdmin.test.js
 * @description Unit tests for SupabaseService admin moderation and deletion capabilities (US6.1 / T0).
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  SupabaseService,
  MockSupabaseClient,
  extractStoragePath,
  supabaseService
} from '../src/services/supabase.js';
import { eventBus } from '../src/utils/eventBus.js';
import { ADMIN_CONFIG } from '../src/config.js';

describe('SupabaseService Admin & Moderation Deletion (US6.1 / T0)', () => {
  beforeEach(() => {
    supabaseService.reset();
  });

  describe('ADMIN_CONFIG Configuration', () => {
    it('should provide default admin credentials in UK English config', () => {
      assert.ok(ADMIN_CONFIG);
      assert.equal(typeof ADMIN_CONFIG.username, 'string');
      assert.equal(typeof ADMIN_CONFIG.password, 'string');
      assert.ok(ADMIN_CONFIG.username.length > 0);
      assert.ok(ADMIN_CONFIG.password.length > 0);
    });
  });

  describe('extractStoragePath Helper', () => {
    it('should extract file path from standard Supabase public storage URL', () => {
      const url = 'https://xyz.supabase.co/storage/v1/object/public/reactions/reaction_123.webm';
      assert.equal(extractStoragePath(url, 'reactions'), 'reaction_123.webm');
    });

    it('should strip query parameters and decode URL encoded path segments', () => {
      const url = 'https://xyz.supabase.co/storage/v1/object/public/reactions/folder%2Fclip_456.mp4?token=abc123xyz';
      assert.equal(extractStoragePath(url, 'reactions'), 'folder/clip_456.mp4');
    });

    it('should return relative paths unchanged', () => {
      assert.equal(extractStoragePath('reaction_789.webm', 'reactions'), 'reaction_789.webm');
      assert.equal(extractStoragePath('subfolder/reaction_789.webm', 'reactions'), 'subfolder/reaction_789.webm');
    });

    it('should fallback to last pathname segment for generic HTTP URLs', () => {
      const url = 'https://cdn.example.com/assets/photos/pic_999.webp?v=1';
      assert.equal(extractStoragePath(url, 'reactions'), 'pic_999.webp');
    });

    it('should safely return null for invalid or empty inputs', () => {
      assert.equal(extractStoragePath(null), null);
      assert.equal(extractStoragePath(undefined), null);
      assert.equal(extractStoragePath(''), null);
      assert.equal(extractStoragePath(12345), null);
    });
  });

  describe('deleteReactionMedia', () => {
    it('should remove target file paths from mock storage bucket', async () => {
      const mockClient = new MockSupabaseClient();
      const service = new SupabaseService({ client: mockClient });

      // Pre-populate storage
      await mockClient.storage.from('reactions').upload('test_vid.webm', { size: 100 });
      await mockClient.storage.from('reactions').upload('test_pic.webp', { size: 50 });

      assert.ok(mockClient.storageData.get('reactions')?.has('test_vid.webm'));
      assert.ok(mockClient.storageData.get('reactions')?.has('test_pic.webp'));

      const result = await service.deleteReactionMedia(['test_vid.webm', 'test_pic.webp']);
      assert.equal(result.length, 2);

      assert.equal(mockClient.storageData.get('reactions')?.has('test_vid.webm'), false);
      assert.equal(mockClient.storageData.get('reactions')?.has('test_pic.webp'), false);
    });

    it('should return empty array when no paths are provided', async () => {
      const service = new SupabaseService({ client: new MockSupabaseClient() });
      const result = await service.deleteReactionMedia([]);
      assert.deepEqual(result, []);
    });
  });

  describe('deleteReactionRecord', () => {
    it('should delete both storage files and the database row, and publish event', async () => {
      const mockClient = new MockSupabaseClient();
      const service = new SupabaseService({ client: mockClient });

      // Pre-populate database and storage
      const videoFilename = 'reaction_purge_vid.webm';
      const photoFilename = 'reaction_purge_pic.webp';
      await mockClient.storage.from('reactions').upload(videoFilename, { size: 2048 });
      await mockClient.storage.from('reactions').upload(photoFilename, { size: 1024 });

      const videoUrl = `https://mock.supabase.co/storage/v1/object/public/reactions/${videoFilename}`;
      const photoUrl = `https://mock.supabase.co/storage/v1/object/public/reactions/${photoFilename}`;

      const inserted = await mockClient.from('hall_of_fame').insert({
        id: 'record-purge-101',
        nickname: 'VampireSlayer',
        video_url: videoUrl,
        photo_url: photoUrl
      }).select();

      const recordId = inserted.data[0].id;

      // Track EventBus publication
      let publishedEvent = null;
      const unsubscribe = eventBus.subscribe('hall-of-fame:record-deleted', (payload) => {
        publishedEvent = payload;
      });

      const outcome = await service.deleteReactionRecord(recordId, { videoUrl, photoUrl }, { useRetry: false });

      unsubscribe();

      // Assert database row was removed
      const remainingRows = mockClient.tableData.get('hall_of_fame') || [];
      assert.equal(remainingRows.some((r) => r.id === recordId), false);

      // Assert storage assets were purged
      assert.equal(mockClient.storageData.get('reactions')?.has(videoFilename), false);
      assert.equal(mockClient.storageData.get('reactions')?.has(photoFilename), false);

      // Assert return metadata and event publication
      assert.equal(outcome.id, recordId);
      assert.equal(outcome.storageErrors.length, 0);
      assert.ok(publishedEvent);
      assert.equal(publishedEvent.id, recordId);
      assert.equal(publishedEvent.videoUrl, videoUrl);
      assert.equal(publishedEvent.photoUrl, photoUrl);
    });

    it('should throw an error when record ID is missing or invalid', async () => {
      const service = new SupabaseService({ client: new MockSupabaseClient() });

      await assert.rejects(
        () => service.deleteReactionRecord(null),
        /A valid record ID is required/
      );
    });

    it('should be fault-tolerant: remove database row even if storage asset deletion fails', async () => {
      const mockClient = new MockSupabaseClient();
      mockClient._simulateRemoveFailure = true;
      const service = new SupabaseService({ client: mockClient });

      const recordId = 'record-storage-fail-102';
      await mockClient.from('hall_of_fame').insert({
        id: recordId,
        nickname: 'ResilientGamer',
        video_url: 'https://mock.supabase.co/storage/v1/object/public/reactions/missing.webm'
      }).select();

      const outcome = await service.deleteReactionRecord(
        recordId,
        { videoUrl: 'https://mock.supabase.co/storage/v1/object/public/reactions/missing.webm' },
        { useRetry: false }
      );

      // Database record should still be deleted
      const remainingRows = mockClient.tableData.get('hall_of_fame') || [];
      assert.equal(remainingRows.some((r) => r.id === recordId), false);

      // Error should be registered in storageErrors without rejecting
      assert.equal(outcome.storageErrors.length, 1);
      assert.match(outcome.storageErrors[0].message, /Simulated cloud storage removal failure/);
    });

    it('should throw an error when database row deletion affects 0 rows (e.g. RLS blocked or missing ID)', async () => {
      const mockClient = new MockSupabaseClient();
      const service = new SupabaseService({ client: mockClient });

      await assert.rejects(
        () => service.deleteReactionRecord('non-existent-id-999', {}, { useRetry: false }),
        /0 rows affected for ID "non-existent-id-999"/
      );
    });
  });
});
