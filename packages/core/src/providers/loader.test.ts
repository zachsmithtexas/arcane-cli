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
        { id: 'mock', enabled: true },
        { id: 'mock2', enabled: true },
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
    config.providers = [];
    const manager = new ProviderManager(config);
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
    expect(response).toBe('Mock2 response for prompt: "test"');
  });

  it('should reload config and update providers', async () => {
    const manager = new ProviderManager(config);
    await manager.initialize();
    expect(manager.getProvider('mock')).toBeDefined();

    const newConfig: ProvidersConfig = {
      providers: [
        { id: 'mock', enabled: false },
        { id: 'mock2', enabled: true },
      ],
      fallbackOrder: ['mock2'],
    };

    await manager.reloadConfig(newConfig);
    expect(manager.getProvider('mock')).toBeUndefined();
    expect(manager.getProvider('mock2')).toBeDefined();
    expect(manager.getPrimaryProvider().id).toBe('mock2');
  });
});
