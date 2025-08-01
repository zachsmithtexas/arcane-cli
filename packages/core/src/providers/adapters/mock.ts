/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/providers/adapters/mock.ts

import { ProviderAdapter } from '../loader.js';

/**
 * A mock provider adapter for testing purposes.
 */
export default class MockAdapter implements ProviderAdapter {
  readonly id = 'mock';
  shouldFail = false;
  private apiKey = '';

  /**
   * Sets the API key for this provider instance.
   * @param apiKey The API key to use for requests.
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Simulates generating content.
   * @param prompt The input prompt.
   * @returns A promise that resolves with a mock response.
   */
  async generateContent(prompt: string): Promise<string> {
    if (this.shouldFail) {
      return Promise.reject(new Error('Mock provider failed'));
    }
    return `Mock response for prompt: "${prompt}" (key: ${this.apiKey.substring(0, 8)}...)`;
  }
}
