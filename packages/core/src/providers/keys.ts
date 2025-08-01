/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/providers/keys.ts

/**
 * @fileoverview API Key rotation and fallback management for AI providers.
 *
 * This module handles multiple API keys per provider, automatic rotation on failures,
 * rate limit tracking, and fallback logic to ensure high availability.
 */

import { z } from 'zod';

/**
 * Represents the status of a single API key.
 */
export enum KeyStatus {
  ACTIVE = 'active',
  RATE_LIMITED = 'rate_limited',
  FAILED = 'failed',
  DISABLED = 'disabled',
}

/**
 * Metadata for a single API key.
 */
export const ApiKeyMetadataSchema = z.object({
  key: z.string().nonempty(),
  status: z.nativeEnum(KeyStatus).default(KeyStatus.ACTIVE),
  failureCount: z.number().default(0),
  lastFailureTime: z.number().optional(), // Unix timestamp
  rateLimitResetTime: z.number().optional(), // Unix timestamp
  lastUsedTime: z.number().optional(), // Unix timestamp
  dailyUsageCount: z.number().default(0),
  maxDailyUsage: z.number().optional(), // Optional rate limit
});

export type ApiKeyMetadata = z.infer<typeof ApiKeyMetadataSchema>;

/**
 * Configuration for key rotation behavior.
 */
export const KeyRotationConfigSchema = z.object({
  maxFailuresBeforeDisable: z.number().default(5),
  failureResetTimeHours: z.number().default(24), // Reset failure count after N hours
  rateLimitBackoffMinutes: z.number().default(60), // Wait N minutes after rate limit
  enableAutoRotation: z.boolean().default(true),
  enableFailureLogging: z.boolean().default(true),
});

export type KeyRotationConfig = z.infer<typeof KeyRotationConfigSchema>;

/**
 * Error types for key rotation failures.
 */
export enum KeyFailureReason {
  RATE_LIMIT = 'rate_limit',
  INVALID_KEY = 'invalid_key',
  NETWORK_ERROR = 'network_error',
  QUOTA_EXCEEDED = 'quota_exceeded',
  UNKNOWN = 'unknown',
}

/**
 * Represents a key rotation failure event.
 */
export interface KeyFailureEvent {
  providerId: string;
  keyIndex: number;
  reason: KeyFailureReason;
  timestamp: number;
  errorMessage?: string;
  retryAfter?: number; // Seconds to wait before retry
}

/**
 * Manages API key rotation and fallback for a single provider.
 */
export class ProviderKeyManager {
  private keys: ApiKeyMetadata[] = [];
  private currentKeyIndex = 0;
  private config: KeyRotationConfig;
  private failureLog: KeyFailureEvent[] = [];

  constructor(
    private providerId: string,
    keys: Array<string | ApiKeyMetadata>,
    config: Partial<KeyRotationConfig> = {},
  ) {
    this.config = KeyRotationConfigSchema.parse(config);
    this.keys = keys.map((key) => {
      if (typeof key === 'string') {
        return ApiKeyMetadataSchema.parse({ key });
      }
      return ApiKeyMetadataSchema.parse(key);
    });

    if (this.keys.length === 0) {
      throw new Error(`No API keys provided for provider '${providerId}'`);
    }

    // Find the first active key
    this.currentKeyIndex = this.findNextActiveKeyIndex();
  }

  /**
   * Gets the currently active API key.
   * @returns The active API key string, or null if no keys are available.
   */
  getCurrentKey(): string | null {
    const activeKey = this.keys[this.currentKeyIndex];
    if (!activeKey || activeKey.status !== KeyStatus.ACTIVE) {
      return null;
    }
    return activeKey.key;
  }

  /**
   * Gets metadata for the currently active key.
   */
  getCurrentKeyMetadata(): ApiKeyMetadata | null {
    return this.keys[this.currentKeyIndex] || null;
  }

  /**
   * Gets all key metadata for this provider.
   */
  getAllKeys(): ApiKeyMetadata[] {
    return [...this.keys];
  }

  /**
   * Adds a new API key to the rotation pool.
   */
  addKey(key: string): void {
    const newKeyData = ApiKeyMetadataSchema.parse({ key });
    this.keys.push(newKeyData);
  }

  /**
   * Removes an API key from the rotation pool.
   */
  removeKey(keyOrIndex: string | number): boolean {
    let indexToRemove: number;

    if (typeof keyOrIndex === 'string') {
      indexToRemove = this.keys.findIndex((k) => k.key === keyOrIndex);
    } else {
      indexToRemove = keyOrIndex;
    }

    if (indexToRemove === -1 || indexToRemove >= this.keys.length) {
      return false;
    }

    this.keys.splice(indexToRemove, 1);

    // Adjust current index if necessary
    if (this.currentKeyIndex >= indexToRemove && this.currentKeyIndex > 0) {
      this.currentKeyIndex--;
    }

    return true;
  }

  /**
   * Records a failure for the current key and attempts to rotate to the next available key.
   */
  async handleKeyFailure(
    reason: KeyFailureReason,
    errorMessage?: string,
    retryAfter?: number,
  ): Promise<boolean> {
    const currentKey = this.keys[this.currentKeyIndex];
    if (!currentKey) {
      return false;
    }

    // Record the failure
    currentKey.failureCount++;
    currentKey.lastFailureTime = Date.now();

    // Create failure event
    const failureEvent: KeyFailureEvent = {
      providerId: this.providerId,
      keyIndex: this.currentKeyIndex,
      reason,
      timestamp: Date.now(),
      errorMessage,
      retryAfter,
    };

    if (this.config.enableFailureLogging) {
      this.failureLog.push(failureEvent);
      console.warn(
        `Key failure for provider '${this.providerId}': ${reason}`,
        errorMessage ? ` - ${errorMessage}` : '',
      );
    }

    // Update key status based on failure reason
    if (reason === KeyFailureReason.RATE_LIMIT) {
      currentKey.status = KeyStatus.RATE_LIMITED;
      currentKey.rateLimitResetTime =
        Date.now() + this.config.rateLimitBackoffMinutes * 60 * 1000;
    } else if (
      currentKey.failureCount >= this.config.maxFailuresBeforeDisable
    ) {
      currentKey.status = KeyStatus.FAILED;
    }

    // Only rotate if the current key is now disabled (failed or rate limited)
    if (
      this.config.enableAutoRotation &&
      currentKey.status !== KeyStatus.ACTIVE
    ) {
      return this.rotateToNextKey();
    }

    return false;
  }

  /**
   * Manually rotates to the next available key.
   */
  rotateToNextKey(): boolean {
    const nextIndex = this.findNextActiveKeyIndex(
      (this.currentKeyIndex + 1) % this.keys.length,
    );

    if (nextIndex === -1) {
      console.error(
        `No active keys available for provider '${this.providerId}'`,
      );
      return false;
    }

    if (nextIndex !== this.currentKeyIndex) {
      this.currentKeyIndex = nextIndex;
      if (this.config.enableFailureLogging) {
        console.log(
          `Rotated to key ${this.currentKeyIndex} for provider '${this.providerId}'`,
        );
      }
      return true;
    }

    return false;
  }

  /**
   * Records successful usage of the current key.
   */
  recordSuccess(): void {
    const currentKey = this.keys[this.currentKeyIndex];
    if (currentKey) {
      currentKey.lastUsedTime = Date.now();
      currentKey.dailyUsageCount++;
    }
  }

  /**
   * Resets keys that have been rate-limited or failed after the configured time periods.
   */
  resetExpiredKeys(): void {
    const now = Date.now();
    const failureResetTime = this.config.failureResetTimeHours * 60 * 60 * 1000;

    for (const key of this.keys) {
      // Reset rate-limited keys
      if (
        key.status === KeyStatus.RATE_LIMITED &&
        key.rateLimitResetTime &&
        now > key.rateLimitResetTime
      ) {
        key.status = KeyStatus.ACTIVE;
        key.rateLimitResetTime = undefined;
      }

      // Reset failed keys after the configured time
      if (
        key.status === KeyStatus.FAILED &&
        key.lastFailureTime &&
        now - key.lastFailureTime > failureResetTime
      ) {
        key.status = KeyStatus.ACTIVE;
        key.failureCount = 0;
        key.lastFailureTime = undefined;
      }
    }
  }

  /**
   * Gets failure statistics for this provider.
   */
  getFailureStats(): {
    totalFailures: number;
    recentFailures: number; // Last 24 hours
    failuresByReason: Record<KeyFailureReason, number>;
    activeKeys: number;
    totalKeys: number;
  } {
    const now = Date.now();
    const last24Hours = 24 * 60 * 60 * 1000;

    const recentFailures = this.failureLog.filter(
      (f) => now - f.timestamp < last24Hours,
    ).length;
    const failuresByReason = this.failureLog.reduce(
      (acc, failure) => {
        acc[failure.reason] = (acc[failure.reason] || 0) + 1;
        return acc;
      },
      {} as Record<KeyFailureReason, number>,
    );

    return {
      totalFailures: this.failureLog.length,
      recentFailures,
      failuresByReason,
      activeKeys: this.keys.filter((k) => k.status === KeyStatus.ACTIVE).length,
      totalKeys: this.keys.length,
    };
  }

  /**
   * Finds the next active key index, starting from the given index.
   */
  private findNextActiveKeyIndex(startIndex = 0): number {
    // Reset expired keys first
    this.resetExpiredKeys();

    // Find next active key
    for (let i = 0; i < this.keys.length; i++) {
      const index = (startIndex + i) % this.keys.length;
      const key = this.keys[index];
      if (key && key.status === KeyStatus.ACTIVE) {
        return index;
      }
    }

    return -1; // No active keys found
  }
}

/**
 * Global key manager that handles all providers.
 */
export class GlobalKeyManager {
  private providerManagers = new Map<string, ProviderKeyManager>();
  private globalConfig: KeyRotationConfig;

  constructor(config: Partial<KeyRotationConfig> = {}) {
    this.globalConfig = KeyRotationConfigSchema.parse(config);
  }

  /**
   * Registers a provider with its API keys.
   */
  registerProvider(
    providerId: string,
    keys: Array<string | ApiKeyMetadata>,
    config?: Partial<KeyRotationConfig>,
  ): void {
    const mergedConfig = { ...this.globalConfig, ...config };
    const manager = new ProviderKeyManager(providerId, keys, mergedConfig);
    this.providerManagers.set(providerId, manager);
  }

  /**
   * Gets the key manager for a specific provider.
   */
  getProviderKeyManager(providerId: string): ProviderKeyManager | undefined {
    return this.providerManagers.get(providerId);
  }

  /**
   * Gets the current active key for a provider.
   */
  getCurrentKey(providerId: string): string | null {
    const manager = this.providerManagers.get(providerId);
    return manager ? manager.getCurrentKey() : null;
  }

  /**
   * Handles a key failure for a specific provider.
   */
  async handleProviderFailure(
    providerId: string,
    reason: KeyFailureReason,
    errorMessage?: string,
    retryAfter?: number,
  ): Promise<boolean> {
    const manager = this.providerManagers.get(providerId);
    if (!manager) {
      return false;
    }
    return manager.handleKeyFailure(reason, errorMessage, retryAfter);
  }

  /**
   * Records successful usage for a provider.
   */
  recordSuccess(providerId: string): void {
    const manager = this.providerManagers.get(providerId);
    if (manager) {
      manager.recordSuccess();
    }
  }

  /**
   * Gets aggregated failure statistics across all providers.
   */
  getGlobalStats(): Record<
    string,
    ReturnType<ProviderKeyManager['getFailureStats']>
  > {
    const stats: Record<
      string,
      ReturnType<ProviderKeyManager['getFailureStats']>
    > = {};

    for (const [providerId, manager] of this.providerManagers) {
      stats[providerId] = manager.getFailureStats();
    }

    return stats;
  }

  /**
   * Resets expired keys across all providers.
   */
  resetAllExpiredKeys(): void {
    for (const manager of this.providerManagers.values()) {
      manager.resetExpiredKeys();
    }
  }
}
