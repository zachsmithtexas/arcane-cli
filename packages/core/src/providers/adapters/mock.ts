// packages/core/src/providers/adapters/mock.ts

import { ProviderAdapter } from '../loader';

/**
 * A mock provider adapter for testing purposes.
 */
export default class MockAdapter implements ProviderAdapter {
  public readonly id = 'mock';
  public shouldFail = false;

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
