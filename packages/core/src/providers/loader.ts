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
import { 
  ApiKeyMetadataSchema, 
  KeyRotationConfigSchema, 
  GlobalKeyManager, 
  KeyFailureReason 
} from './keys.js';
import { getUsageStatsManager } from '../telemetry/usageStats.js';

/**
 * Defines the schema for a single provider's configuration.
 */
export const ProviderConfigSchema = z.object({
  id: z.string().nonempty(),
  apiKey: z.string().optional(), // Legacy single key support
  apiKeys: z.array(z.union([z.string(), ApiKeyMetadataSchema])).optional(), // New multi-key support
  enabled: z.boolean().default(true),
  keyRotationConfig: KeyRotationConfigSchema.partial().optional(),
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
   * Sets the API key for this provider instance.
   * @param apiKey The API key to use for requests.
   */
  setApiKey(apiKey: string): void;

  /**
   * Generates content based on a given prompt.
   * @param prompt The input prompt to send to the AI model.
   * @returns A promise that resolves with the generated content.
   * @throws Will throw specific errors that can be categorized for key rotation.
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
  private keyManager: GlobalKeyManager;

  constructor(private config: ProvidersConfig) {
    this.fallbackOrder = config.fallbackOrder || [];
    this.keyManager = new GlobalKeyManager();
  }

  /**
   * Initializes the provider manager by loading all enabled providers.
   */
  async initialize(): Promise<void> {
    for (const providerConfig of this.config.providers) {
      if (providerConfig.enabled) {
        try {
          // Determine which keys to use (support both legacy single key and new multi-key)
          let keys: (string | any)[] = [];
          if (providerConfig.apiKeys && providerConfig.apiKeys.length > 0) {
            keys = providerConfig.apiKeys;
          } else if (providerConfig.apiKey) {
            keys = [providerConfig.apiKey];
          }

          if (keys.length === 0) {
            console.warn(`No API keys configured for provider '${providerConfig.id}'. Skipping.`);
            continue;
          }

          // Register the provider with the key manager
          this.keyManager.registerProvider(
            providerConfig.id,
            keys,
            providerConfig.keyRotationConfig
          );

          // Load the provider adapter
          const adapter = await loadProviderAdapter(providerConfig.id);
          
          // Set initial API key
          const initialKey = this.keyManager.getCurrentKey(providerConfig.id);
          if (initialKey) {
            adapter.setApiKey(initialKey);
            this.providers.set(providerConfig.id, adapter);
          } else {
            console.warn(`No active keys available for provider '${providerConfig.id}'.`);
          }
        } catch (error) {
          console.warn(`Could not initialize provider '${providerConfig.id}':`, error);
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
   * Generates content using the primary provider, with fallback to other providers and key rotation.
   * @param prompt The input prompt.
   * @returns The generated content.
   * @throws If all providers and keys fail.
   */
  async generateContentWithFallback(prompt: string): Promise<string> {
    const maxRetries = 3;
    const usageStats = getUsageStatsManager();
    
    for (const providerId of this.fallbackOrder) {
      const provider = this.getProvider(providerId);
      if (!provider) {
        continue;
      }

      // Try current provider with key rotation support
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const startTime = Date.now();
        
        try {
          // Get current key for this provider
          const currentKey = this.keyManager.getCurrentKey(providerId);
          if (!currentKey) {
            console.warn(`No active keys for provider '${providerId}', skipping.`);
            break; // Move to next provider
          }

          // Update provider with current key
          provider.setApiKey(currentKey);

          // Attempt to generate content
          const result = await provider.generateContent(prompt);
          const responseTime = Date.now() - startTime;
          
          // Record success
          this.keyManager.recordSuccess(providerId);
          await usageStats.recordProviderUsage(providerId, true, responseTime);
          
          return result;
          
        } catch (error) {
          const responseTime = Date.now() - startTime;
          console.warn(`Provider '${providerId}' failed (attempt ${attempt + 1}):`, error);
          
          // Determine failure reason and handle key rotation
          const failureReason = this.categorizeError(error);
          const rotated = await this.keyManager.handleProviderFailure(
            providerId,
            failureReason,
            error instanceof Error ? error.message : String(error)
          );

          // Record provider failure in usage stats
          await usageStats.recordProviderUsage(providerId, false, responseTime, 0, failureReason);
          
          // Record key rotation if it occurred
          if (rotated) {
            await usageStats.recordKeyRotation(providerId);
          }

          // If we couldn't rotate to a new key, break and try next provider
          if (!rotated) {
            break;
          }
          
          // If it's a rate limit, wait a bit before retrying
          if (failureReason === KeyFailureReason.RATE_LIMIT) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
      }
    }
    
    throw new Error('All providers and keys failed to generate content.');
  }

  /**
   * Categorizes an error to determine the appropriate key rotation response.
   */
  private categorizeError(error: unknown): KeyFailureReason {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('quota') || errorMessage.includes('429')) {
      return KeyFailureReason.RATE_LIMIT;
    } else if (errorMessage.includes('invalid') && errorMessage.includes('key')) {
      return KeyFailureReason.INVALID_KEY;
    } else if (errorMessage.includes('quota exceeded')) {
      return KeyFailureReason.QUOTA_EXCEEDED;
    } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return KeyFailureReason.NETWORK_ERROR;
    }
    
    return KeyFailureReason.UNKNOWN;
  }

  /**
   * Reloads the configuration and re-initializes the providers.
   * @param newConfig The new provider configuration.
   */
  async reloadConfig(newConfig: ProvidersConfig): Promise<void> {
    this.config = newConfig;
    this.fallbackOrder = newConfig.fallbackOrder || [];
    this.providers.clear();
    // Create new key manager to reset state
    this.keyManager = new GlobalKeyManager();
    await this.initialize();
  }

  /**
   * Gets the global key manager for advanced key operations.
   */
  getKeyManager(): GlobalKeyManager {
    return this.keyManager;
  }

  /**
   * Gets key statistics for all providers.
   */
  getKeyStats(): Record<string, ReturnType<GlobalKeyManager['getGlobalStats']>[string]> {
    return this.keyManager.getGlobalStats();
  }

  /**
   * Manually resets expired keys across all providers.
   */
  resetExpiredKeys(): void {
    this.keyManager.resetAllExpiredKeys();
  }
}
