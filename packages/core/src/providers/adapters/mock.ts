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

  /**
   * Simulates generating content.
   * @param prompt The input prompt.
   * @returns A promise that resolves with a mock response.
   */
  async generateContent(prompt: string): Promise<string> {
    if (this.shouldFail) {
      return Promise.reject(new Error('Mock provider failed'));
    }
    return `Mock response for prompt: "${prompt}"`;
  }
}
