/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/providers/keys.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProviderKeyManager,
  GlobalKeyManager,
  KeyStatus,
  KeyFailureReason,
  ApiKeyMetadata,
} from './keys.js';

describe('ProviderKeyManager', () => {
  let keyManager: ProviderKeyManager;
  const testKeys = ['key1', 'key2', 'key3'];

  beforeEach(() => {
    keyManager = new ProviderKeyManager('test-provider', testKeys);
  });

  describe('initialization', () => {
    it('should initialize with string keys', () => {
      expect(keyManager.getCurrentKey()).toBe('key1');
      expect(keyManager.getAllKeys()).toHaveLength(3);
    });

    it('should initialize with ApiKeyMetadata objects', () => {
      const metadataKeys: ApiKeyMetadata[] = [
        {
          key: 'meta-key-1',
          status: KeyStatus.ACTIVE,
          failureCount: 0,
          dailyUsageCount: 0,
        },
        {
          key: 'meta-key-2',
          status: KeyStatus.RATE_LIMITED,
          failureCount: 1,
          dailyUsageCount: 0,
        },
      ];

      const manager = new ProviderKeyManager('test', metadataKeys);
      expect(manager.getCurrentKey()).toBe('meta-key-1');
      expect(manager.getAllKeys()).toHaveLength(2);
    });

    it('should throw error when no keys provided', () => {
      expect(() => {
        new ProviderKeyManager('test', []);
      }).toThrow('No API keys provided');
    });

    it('should find first active key when some are disabled', () => {
      const keys: ApiKeyMetadata[] = [
        {
          key: 'disabled-key',
          status: KeyStatus.FAILED,
          failureCount: 5,
          dailyUsageCount: 0,
        },
        {
          key: 'active-key',
          status: KeyStatus.ACTIVE,
          failureCount: 0,
          dailyUsageCount: 0,
        },
      ];

      const manager = new ProviderKeyManager('test', keys);
      expect(manager.getCurrentKey()).toBe('active-key');
    });
  });

  describe('key management', () => {
    it('should add new keys', () => {
      keyManager.addKey('new-key');
      expect(keyManager.getAllKeys()).toHaveLength(4);
      expect(keyManager.getAllKeys()[3].key).toBe('new-key');
    });

    it('should remove keys by string', () => {
      const success = keyManager.removeKey('key2');
      expect(success).toBe(true);
      expect(keyManager.getAllKeys()).toHaveLength(2);
      expect(
        keyManager.getAllKeys().find((k) => k.key === 'key2'),
      ).toBeUndefined();
    });

    it('should remove keys by index', () => {
      const success = keyManager.removeKey(1);
      expect(success).toBe(true);
      expect(keyManager.getAllKeys()).toHaveLength(2);
      expect(
        keyManager.getAllKeys().find((k) => k.key === 'key2'),
      ).toBeUndefined();
    });

    it('should return false for invalid key removal', () => {
      expect(keyManager.removeKey('non-existent')).toBe(false);
      expect(keyManager.removeKey(10)).toBe(false);
    });
  });

  describe('failure handling', () => {
    it('should handle rate limit failures', async () => {
      const rotated = await keyManager.handleKeyFailure(
        KeyFailureReason.RATE_LIMIT,
        'Rate limit exceeded',
        3600,
      );

      expect(rotated).toBe(true);
      expect(keyManager.getCurrentKey()).toBe('key2'); // Should rotate to next key

      const failedKey = keyManager.getAllKeys()[0];
      expect(failedKey.status).toBe(KeyStatus.RATE_LIMITED);
      expect(failedKey.failureCount).toBe(1);
    });

    it('should disable key after max failures', async () => {
      const config = { maxFailuresBeforeDisable: 2 };
      const manager = new ProviderKeyManager('test', ['key1', 'key2'], config);

      // First failure - should not disable yet, should not rotate
      const rotated1 = await manager.handleKeyFailure(
        KeyFailureReason.INVALID_KEY,
      );
      expect(rotated1).toBe(false); // Should not rotate yet
      expect(manager.getCurrentKey()).toBe('key1'); // Still on key1
      const firstKeyAfterFirstFailure = manager
        .getAllKeys()
        .find((k) => k.key === 'key1');
      expect(firstKeyAfterFirstFailure?.status).toBe(KeyStatus.ACTIVE);
      expect(firstKeyAfterFirstFailure?.failureCount).toBe(1);

      // Second failure - should disable the key and rotate
      const rotated2 = await manager.handleKeyFailure(
        KeyFailureReason.INVALID_KEY,
      );
      expect(rotated2).toBe(true); // Should rotate now
      const firstKey = manager.getAllKeys().find((k) => k.key === 'key1');
      expect(firstKey?.failureCount).toBe(2);
      expect(firstKey?.status).toBe(KeyStatus.FAILED);
      expect(manager.getCurrentKey()).toBe('key2');
    });

    it('should return false when no keys available for rotation', async () => {
      const singleKeyManager = new ProviderKeyManager('test', ['only-key']);

      const rotated = await singleKeyManager.handleKeyFailure(
        KeyFailureReason.INVALID_KEY,
      );

      expect(rotated).toBe(false);
    });

    it('should record failure events', async () => {
      await keyManager.handleKeyFailure(
        KeyFailureReason.NETWORK_ERROR,
        'Connection timeout',
      );

      const stats = keyManager.getFailureStats();
      expect(stats.totalFailures).toBe(1);
      expect(stats.failuresByReason[KeyFailureReason.NETWORK_ERROR]).toBe(1);
    });
  });

  describe('success recording', () => {
    it('should record successful usage', () => {
      keyManager.recordSuccess();

      const currentKey = keyManager.getCurrentKeyMetadata();
      expect(currentKey?.lastUsedTime).toBeDefined();
      expect(currentKey?.dailyUsageCount).toBe(1);
    });
  });

  describe('key rotation', () => {
    it('should manually rotate to next key', () => {
      const rotated = keyManager.rotateToNextKey();
      expect(rotated).toBe(true);
      expect(keyManager.getCurrentKey()).toBe('key2');
    });

    it('should skip disabled keys during rotation', () => {
      // Disable second key
      keyManager.getAllKeys()[1].status = KeyStatus.FAILED;

      const rotated = keyManager.rotateToNextKey();
      expect(rotated).toBe(true);
      expect(keyManager.getCurrentKey()).toBe('key3'); // Should skip key2
    });
  });

  describe('expired key reset', () => {
    it('should reset rate-limited keys after backoff period', () => {
      const keys = keyManager.getAllKeys();
      keys[0].status = KeyStatus.RATE_LIMITED;
      keys[0].rateLimitResetTime = Date.now() - 1000; // 1 second ago

      keyManager.resetExpiredKeys();
      expect(keys[0].status).toBe(KeyStatus.ACTIVE);
      expect(keys[0].rateLimitResetTime).toBeUndefined();
    });

    it('should reset failed keys after failure reset period', () => {
      const config = { failureResetTimeHours: 0.001 }; // Very short for testing
      const manager = new ProviderKeyManager('test', testKeys, config);

      const keys = manager.getAllKeys();
      keys[0].status = KeyStatus.FAILED;
      keys[0].lastFailureTime = Date.now() - 10000; // 10 seconds ago
      keys[0].failureCount = 5;

      manager.resetExpiredKeys();
      expect(keys[0].status).toBe(KeyStatus.ACTIVE);
      expect(keys[0].failureCount).toBe(0);
      expect(keys[0].lastFailureTime).toBeUndefined();
    });
  });

  describe('statistics', () => {
    it('should provide accurate failure statistics', async () => {
      await keyManager.handleKeyFailure(KeyFailureReason.RATE_LIMIT);
      await keyManager.handleKeyFailure(KeyFailureReason.NETWORK_ERROR);

      const stats = keyManager.getFailureStats();
      expect(stats.totalFailures).toBe(2);
      expect(stats.recentFailures).toBe(2); // Both within 24 hours
      expect(stats.failuresByReason[KeyFailureReason.RATE_LIMIT]).toBe(1);
      expect(stats.failuresByReason[KeyFailureReason.NETWORK_ERROR]).toBe(1);
      expect(stats.activeKeys).toBe(2); // key2 and key3 still active
      expect(stats.totalKeys).toBe(3);
    });
  });
});

describe('GlobalKeyManager', () => {
  let globalManager: GlobalKeyManager;

  beforeEach(() => {
    globalManager = new GlobalKeyManager();
  });

  describe('provider registration', () => {
    it('should register providers with keys', () => {
      globalManager.registerProvider('test-provider', ['key1', 'key2']);

      const key = globalManager.getCurrentKey('test-provider');
      expect(key).toBe('key1');
    });

    it('should handle multiple providers', () => {
      globalManager.registerProvider('provider1', ['key1a', 'key1b']);
      globalManager.registerProvider('provider2', ['key2a', 'key2b']);

      expect(globalManager.getCurrentKey('provider1')).toBe('key1a');
      expect(globalManager.getCurrentKey('provider2')).toBe('key2a');
    });
  });

  describe('failure handling', () => {
    beforeEach(() => {
      globalManager.registerProvider('test-provider', ['key1', 'key2', 'key3']);
    });

    it('should handle provider failures', async () => {
      const rotated = await globalManager.handleProviderFailure(
        'test-provider',
        KeyFailureReason.RATE_LIMIT,
        'Rate limit exceeded',
      );

      expect(rotated).toBe(true);
      expect(globalManager.getCurrentKey('test-provider')).toBe('key2');
    });

    it('should return false for non-existent providers', async () => {
      const rotated = await globalManager.handleProviderFailure(
        'non-existent',
        KeyFailureReason.INVALID_KEY,
      );

      expect(rotated).toBe(false);
    });
  });

  describe('success recording', () => {
    it('should record success for providers', () => {
      globalManager.registerProvider('test-provider', ['key1']);

      // Should not throw
      globalManager.recordSuccess('test-provider');
      globalManager.recordSuccess('non-existent'); // Should be safe
    });
  });

  describe('global statistics', () => {
    it('should provide aggregated statistics', async () => {
      globalManager.registerProvider('provider1', ['key1a', 'key1b']);
      globalManager.registerProvider('provider2', ['key2a']);

      await globalManager.handleProviderFailure(
        'provider1',
        KeyFailureReason.RATE_LIMIT,
      );

      const stats = globalManager.getGlobalStats();
      expect(stats['provider1']).toBeDefined();
      expect(stats['provider2']).toBeDefined();
      expect(stats['provider1'].totalFailures).toBe(1);
      expect(stats['provider2'].totalFailures).toBe(0);
    });
  });

  describe('expired key reset', () => {
    it('should reset expired keys across all providers', () => {
      globalManager.registerProvider('provider1', ['key1']);
      globalManager.registerProvider('provider2', ['key2']);

      // Should not throw
      globalManager.resetAllExpiredKeys();
    });
  });
});
