/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/providers/loader.test.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProviderManager, ProvidersConfig, ProviderAdapter } from './loader.js';

// Mock the dynamic import
vi.mock('./adapters/mock.ts', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    default: new () => ProviderAdapter;
  };
  return {
    default: actual.default,
  };
});

vi.mock('./adapters/mock2.ts', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    default: new () => ProviderAdapter;
  };
  return {
    default: actual.default,
  };
});

describe('ProviderManager', () => {
  let config: ProvidersConfig;

  beforeEach(() => {
    config = {
      providers: [
        { id: 'mock', enabled: true, apiKeys: ['mock-key-1', 'mock-key-2'] },
        { id: 'mock2', enabled: true, apiKeys: ['mock2-key-1'] },
      ],
      fallbackOrder: ['mock', 'mock2'],
    };
  });

  it('should initialize and load enabled providers', async () => {
    const manager = new ProviderManager(config);
    await manager.initialize();
    const provider = manager.getProvider('mock');
    expect(provider).toBeDefined();
    expect(provider!.id).toBe('mock');
    const provider2 = manager.getProvider('mock2');
    expect(provider2).toBeDefined();
    expect(provider2!.id).toBe('mock2');
  });

  it('should support legacy single apiKey format', async () => {
    const legacyConfig: ProvidersConfig = {
      providers: [{ id: 'mock', enabled: true, apiKey: 'legacy-key' }],
      fallbackOrder: ['mock'],
    };

    const manager = new ProviderManager(legacyConfig);
    await manager.initialize();
    expect(manager.getProvider('mock')).toBeDefined();
  });

  it('should skip providers without API keys', async () => {
    const noKeyConfig: ProvidersConfig = {
      providers: [
        { id: 'mock', enabled: true }, // No keys
        { id: 'mock2', enabled: true, apiKeys: ['key1'] },
      ],
      fallbackOrder: ['mock', 'mock2'],
    };

    const manager = new ProviderManager(noKeyConfig);
    await manager.initialize();
    expect(manager.getProvider('mock')).toBeUndefined();
    expect(manager.getProvider('mock2')).toBeDefined();
  });

  it('should not load disabled providers', async () => {
    config.providers[0].enabled = false;
    const manager = new ProviderManager(config);
    await manager.initialize();
    const provider = manager.getProvider('mock');
    expect(provider).toBeUndefined();
    const provider2 = manager.getProvider('mock2');
    expect(provider2).toBeDefined();
  });

  it('should throw an error if no providers can be initialized', async () => {
    const emptyConfig: ProvidersConfig = {
      providers: [],
      fallbackOrder: [],
    };
    const manager = new ProviderManager(emptyConfig);
    await expect(manager.initialize()).rejects.toThrow(
      'No AI providers could be initialized.',
    );
  });

  it('should return the primary provider', async () => {
    const manager = new ProviderManager(config);
    await manager.initialize();
    const provider = manager.getPrimaryProvider();
    expect(provider).toBeDefined();
    expect(provider.id).toBe('mock');
  });

  it('should use fallback provider if primary fails', async () => {
    const manager = new ProviderManager(config);
    await manager.initialize();
    const mockProvider = manager.getProvider('mock') as ProviderAdapter & {
      shouldFail: boolean;
    };
    mockProvider.shouldFail = true;

    const response = await manager.generateContentWithFallback('test');
    expect(response).toContain('Mock2 response for prompt: "test"');
  });

  it('should handle key rotation on failures', async () => {
    const manager = new ProviderManager(config);
    await manager.initialize();

    // Get initial key stats
    const initialStats = manager.getKeyStats();
    expect(initialStats['mock'].activeKeys).toBe(2);

    // Simulate a failure that would trigger key rotation
    const mockProvider = manager.getProvider('mock') as ProviderAdapter & {
      shouldFail: boolean;
    };
    mockProvider.shouldFail = true;

    // This should trigger key rotation and eventually fallback to mock2
    const response = await manager.generateContentWithFallback('test');
    expect(response).toContain('Mock2 response');
  });

  it('should reload config and update providers', async () => {
    const manager = new ProviderManager(config);
    await manager.initialize();
    expect(manager.getProvider('mock')).toBeDefined();

    const newConfig: ProvidersConfig = {
      providers: [
        { id: 'mock', enabled: false, apiKeys: ['key1'] },
        { id: 'mock2', enabled: true, apiKeys: ['key2'] },
      ],
      fallbackOrder: ['mock2'],
    };

    await manager.reloadConfig(newConfig);
    expect(manager.getProvider('mock')).toBeUndefined();
    expect(manager.getProvider('mock2')).toBeDefined();
    expect(manager.getPrimaryProvider().id).toBe('mock2');
  });

  it('should provide key statistics', async () => {
    const manager = new ProviderManager(config);
    await manager.initialize();

    const stats = manager.getKeyStats();
    expect(stats['mock']).toBeDefined();
    expect(stats['mock'].totalKeys).toBe(2);
    expect(stats['mock'].activeKeys).toBe(2);
    expect(stats['mock2']).toBeDefined();
    expect(stats['mock2'].totalKeys).toBe(1);
  });

  it('should reset expired keys', async () => {
    const manager = new ProviderManager(config);
    await manager.initialize();

    // Should not throw
    manager.resetExpiredKeys();
  });

  it('should access key manager', async () => {
    const manager = new ProviderManager(config);
    await manager.initialize();

    const keyManager = manager.getKeyManager();
    expect(keyManager).toBeDefined();

    const globalStats = keyManager.getGlobalStats();
    expect(globalStats['mock']).toBeDefined();
    expect(globalStats['mock2']).toBeDefined();
  });
});
