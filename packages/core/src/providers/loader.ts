/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/providers/loader.ts

/**
 * @fileoverview Modular loader for AI provider plugins.
 *
 * This module is responsible for loading AI providers based on a configuration,
 * supporting dynamic loading, and handling fallbacks.
 */

import { z } from 'zod';

/**
 * Defines the schema for a single provider's configuration.
 */
export const ProviderConfigSchema = z.object({
  id: z.string().nonempty(),
  apiKey: z.string().optional(),
  enabled: z.boolean().default(true),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/**
 * Defines the schema for the overall provider configuration file.
 */
export const ProvidersConfigSchema = z.object({
  providers: z.array(ProviderConfigSchema),
  fallbackOrder: z.array(z.string()).optional(),
});

export type ProvidersConfig = z.infer<typeof ProvidersConfigSchema>;

/**
 * Interface for an AI provider adapter.
 * Each provider will implement this interface to ensure consistency.
 */
export interface ProviderAdapter {
  /**
   * A unique identifier for the provider (e.g., 'gemini', 'openrouter').
   */
  readonly id: string;

  /**
   * Generates content based on a given prompt.
   * @param prompt The input prompt to send to the AI model.
   * @returns A promise that resolves with the generated content.
   */
  generateContent(prompt: string): Promise<string>;
}

/**
 * Dynamically loads a provider adapter based on its ID.
 * This simulates a plugin system where adapters are in a specific directory.
 *
 * @param providerId The ID of the provider to load (e.g., 'gemini').
 * @returns A promise that resolves with the provider adapter instance.
 * @throws If the provider adapter module cannot be found or loaded.
 */
async function loadProviderAdapter(
  providerId: string,
): Promise<ProviderAdapter> {
  try {
    // Assuming adapters are located in './adapters/[providerId]'
    const adapterModule = await import(`./adapters/${providerId}.ts`);
    if (!adapterModule.default || typeof adapterModule.default !== 'function') {
      throw new Error(
        `Adapter module for '${providerId}' does not have a valid default export.`,
      );
    }
    // The constructor should return an instance of ProviderAdapter
    const adapterInstance: ProviderAdapter = new adapterModule.default();
    return adapterInstance;
  } catch (error) {
    console.error(
      `Failed to load provider adapter for '${providerId}':`,
      error,
    );
    throw new Error(`Provider adapter for '${providerId}' not found.`);
  }
}

/**
 * Manages AI providers, including loading, selecting, and handling fallbacks.
 */
export class ProviderManager {
  private providers: Map<string, ProviderAdapter> = new Map();
  private fallbackOrder: string[] = [];

  constructor(private config: ProvidersConfig) {
    this.fallbackOrder = config.fallbackOrder || [];
  }

  /**
   * Initializes the provider manager by loading all enabled providers.
   */
  async initialize(): Promise<void> {
    for (const providerConfig of this.config.providers) {
      if (providerConfig.enabled) {
        try {
          const adapter = await loadProviderAdapter(providerConfig.id);
          this.providers.set(providerConfig.id, adapter);
        } catch (_error) {
          console.warn(`Could not initialize provider '${providerConfig.id}'.`);
        }
      }
    }
    if (this.providers.size === 0) {
      throw new Error('No AI providers could be initialized.');
    }
  }

  /**
   * Gets a specific provider by its ID.
   *
   * @param id The ID of the provider to retrieve.
   * @returns The provider adapter, or undefined if not found.
   */
  getProvider(id: string): ProviderAdapter | undefined {
    return this.providers.get(id);
  }

  /**
   * Gets the primary provider, which is the first one in the loaded list
   * or the first in the fallback order if specified.
   *
   * @returns The primary provider adapter.
   * @throws If no providers are available.
   */
  getPrimaryProvider(): ProviderAdapter {
    const primaryId =
      this.fallbackOrder[0] || this.providers.keys().next().value;
    if (!primaryId) {
      throw new Error('No primary provider available.');
    }
    const provider = this.getProvider(primaryId);
    if (!provider) {
      throw new Error(`Primary provider '${primaryId}' could not be loaded.`);
    }
    return provider;
  }

  /**
   * Generates content using the primary provider, with fallback to other providers.
   * @param prompt The input prompt.
   * @returns The generated content.
   * @throws If all providers fail.
   */
  async generateContentWithFallback(prompt: string): Promise<string> {
    for (const providerId of this.fallbackOrder) {
      const provider = this.getProvider(providerId);
      if (provider) {
        try {
          return await provider.generateContent(prompt);
        } catch (error) {
          console.warn(`Provider '${providerId}' failed:`, error);
          // Try the next provider
        }
      }
    }
    throw new Error('All providers failed to generate content.');
  }

  /**
   * Reloads the configuration and re-initializes the providers.
   * @param newConfig The new provider configuration.
   */
  async reloadConfig(newConfig: ProvidersConfig): Promise<void> {
    this.config = newConfig;
    this.fallbackOrder = newConfig.fallbackOrder || [];
    this.providers.clear();
    await this.initialize();
  }
}
