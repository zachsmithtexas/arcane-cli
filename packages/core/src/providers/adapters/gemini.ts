// packages/core/src/providers/adapters/gemini.ts

import { GoogleGenerativeAI } from '@google/genai';
import { ProviderAdapter } from '../loader';

/**
 * An adapter for the Google Gemini provider.
 */
export default class GeminiAdapter implements ProviderAdapter {
  public readonly id = 'gemini';
  private genAI: GoogleGenerativeAI;

  constructor(apiKey?: string) {
    if (!apiKey) {
      throw new Error('Gemini API key is required.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Generates content using the Gemini API.
   * @param prompt The input prompt.
   * @returns A promise that resolves with the generated content.
   */
  async generateContent(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }
}
