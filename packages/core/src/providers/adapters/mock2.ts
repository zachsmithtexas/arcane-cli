/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/providers/adapters/mock2.ts

import { ProviderAdapter } from '../loader.js';

/**
 * A second mock provider adapter for testing purposes.
 */
export default class Mock2Adapter implements ProviderAdapter {
  readonly id = 'mock2';
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
    return `Mock2 response for prompt: "${prompt}" (key: ${this.apiKey.substring(0, 8)}...)`;
  }
}
