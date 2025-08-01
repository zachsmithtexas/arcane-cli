/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/providers/adapters/gemini.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProviderAdapter } from '../loader.js';

/**
 * An adapter for the Google Gemini provider.
 */
export default class GeminiAdapter implements ProviderAdapter {
  readonly id = 'gemini';
  private genAI: GoogleGenerativeAI;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || '';
    if (!this.apiKey) {
      // Allow empty initialization, key will be set later via setApiKey
      this.genAI = new GoogleGenerativeAI('placeholder');
    } else {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
  }

  /**
   * Sets the API key for this provider instance.
   * @param apiKey The API key to use for requests.
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Generates content using the Gemini API.
   * @param prompt The input prompt.
   * @returns A promise that resolves with the generated content.
   */
  async generateContent(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is required.');
    }

    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }
}
