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

  /**
   * Simulates generating content.
   * @param prompt The input prompt.
   * @returns A promise that resolves with a mock response.
   */
  async generateContent(prompt: string): Promise<string> {
    return `Mock2 response for prompt: "${prompt}"`;
  }
}
