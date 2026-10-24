/**
 * @file databaseInsert.test.js
 * @description Unit and integration tests for Supabase Database reaction insertion pipeline.
 * Standards: UK English (en-GB), Node.js native test runner (node:test).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  SupabaseService,
  MockSupabaseClient
} from '../src/services/supabase.js';

describe('Database Insertion Pipeline Unit & Integration Tests (US3.3 / T6)', () => {
  let service;
  let mockClient;

  beforeEach(() => {
    mockClient = new MockSupabaseClient({
      url: 'https://test-dawlloween.supabase.co',
      anonKey: 'anon-test-key',
      tableName: 'hall_of_fame',
      maxRetries: 2,
      retryDelayMs: 20
    });

    service = new SupabaseService({
      client: mockClient,
      config: {
        url: 'https://test-dawlloween.supabase.co',
        anonKey: 'anon-test-key',
        tableName: 'hall_of_fame',
        maxRetries: 2,
        retryDelayMs: 20
      }
    });
  });

  it('should reject insertion when nickname is invalid or missing', async () => {
    await assert.rejects(
      async () => service.insertReactionRecord({ nickname: '', videoUrl: 'https://example.com/v.webm' }),
      /A valid player nickname is required/
    );

    await assert.rejects(
      async () => service.insertReactionRecord({ nickname: '   ', videoUrl: 'https://example.com/v.webm' }),
      /A valid player nickname is required/
    );

    await assert.rejects(
      async () => service.insertReactionRecord({ nickname: null, videoUrl: 'https://example.com/v.webm' }),
      /A valid player nickname is required/
    );
  });

  it('should reject insertion when both videoUrl and photoUrl are missing', async () => {
    await assert.rejects(
      async () => service.insertReactionRecord({ nickname: 'GamerGhost', videoUrl: null, photoUrl: null }),
      /At least one media reference \(videoUrl or photoUrl\) is required/
    );

    await assert.rejects(
      async () => service.insertReactionRecord({ nickname: 'GamerGhost' }),
      /At least one media reference \(videoUrl or photoUrl\) is required/
    );
  });

  it('should successfully insert reaction record with videoUrl and photoUrl', async () => {
    const record = await service.insertReactionRecord({
      nickname: '  SpookyCoder  ',
      videoUrl: 'https://test-dawlloween.supabase.co/storage/v1/object/public/reactions/clip.webm',
      photoUrl: 'https://test-dawlloween.supabase.co/storage/v1/object/public/reactions/photo.webp'
    }, { useRetry: false });

    assert.ok(record.id, 'Record should have generated id');
    assert.equal(record.nickname, 'SpookyCoder', 'Nickname should be trimmed');
    assert.equal(record.video_url, 'https://test-dawlloween.supabase.co/storage/v1/object/public/reactions/clip.webm');
    assert.equal(record.photo_url, 'https://test-dawlloween.supabase.co/storage/v1/object/public/reactions/photo.webp');
    assert.ok(record.created_at, 'Should have ISO created_at timestamp');

    // Verify stored item in mock database table
    const tableList = mockClient.tableData.get('hall_of_fame');
    assert.equal(tableList.length, 1);
    assert.equal(tableList[0].id, record.id);
  });

  it('should support insertion with fallback photoUrl only (when videoUrl is null)', async () => {
    const record = await service.insertReactionRecord({
      nickname: 'FallbackPlayer',
      videoUrl: null,
      photoUrl: 'https://test-dawlloween.supabase.co/storage/v1/object/public/reactions/photo.webp'
    }, { useRetry: false });

    assert.equal(record.nickname, 'FallbackPlayer');
    assert.equal(record.video_url, null);
    assert.equal(record.photo_url, 'https://test-dawlloween.supabase.co/storage/v1/object/public/reactions/photo.webp');
  });

  it('should support custom table name override', async () => {
    const record = await service.insertReactionRecord({
      nickname: 'VIPGhost',
      videoUrl: 'https://example.com/vip.webm'
    }, {
      tableName: 'custom_hall_of_fame',
      useRetry: false
    });

    assert.equal(record.nickname, 'VIPGhost');
    const customList = mockClient.tableData.get('custom_hall_of_fame');
    assert.ok(customList);
    assert.equal(customList.length, 1);
  });

  it('should automatically recover from transient database failure via retry', async () => {
    let callCount = 0;
    mockClient.from = (tableName) => ({
      insert: (records) => ({
        select: async () => {
          callCount++;
          if (callCount === 1) {
            return { data: null, error: new Error('Temporary connection microcut') };
          }
          return { data: [{ id: 'recovered-id', ...records }], error: null };
        }
      })
    });

    const record = await service.insertReactionRecord({
      nickname: 'ResilientPlayer',
      videoUrl: 'https://example.com/recovered.webm'
    }, {
      useRetry: true,
      maxRetries: 3,
      retryDelayMs: 20
    });

    assert.equal(callCount, 2, 'Should succeed on second retry attempt');
    assert.equal(record.id, 'recovered-id');
    assert.equal(record.nickname, 'ResilientPlayer');
  });

  it('should throw error when database insertion permanently fails after retries', async () => {
    mockClient._simulateDbFailure = true;

    await assert.rejects(async () => {
      await service.insertReactionRecord({
        nickname: 'FailingPlayer',
        videoUrl: 'https://example.com/fail.webm'
      }, {
        useRetry: true,
        maxRetries: 2,
        retryDelayMs: 20
      });
    }, /Simulated database insertion failure/);
  });

  it('should retrieve inserted records via fetchHallOfFame', async () => {
    await service.insertReactionRecord({
      nickname: 'PlayerOne',
      videoUrl: 'https://example.com/1.webm'
    }, { useRetry: false });

    await service.insertReactionRecord({
      nickname: 'PlayerTwo',
      photoUrl: 'https://example.com/2.webp'
    }, { useRetry: false });

    const records = await service.fetchHallOfFame();
    assert.equal(records.length, 2);
    assert.equal(records[0].nickname, 'PlayerOne');
    assert.equal(records[1].nickname, 'PlayerTwo');
  });
});
