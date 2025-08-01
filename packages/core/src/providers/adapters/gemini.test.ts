/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/providers/adapters/gemini.test.ts

import { vi, describe, it, expect } from 'vitest';
import GeminiAdapter from './gemini.js';

const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

describe('GeminiAdapter', () => {
  it('should throw an error when generating content without API key', async () => {
    const adapter = new GeminiAdapter();
    await expect(adapter.generateContent('test prompt')).rejects.toThrow('Gemini API key is required.');
  });

  it('should call the Gemini API with the correct prompt', async () => {
    const adapter = new GeminiAdapter('test-api-key');
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'test response',
      },
    });

    const response = await adapter.generateContent('test prompt');
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-pro',
    });
    expect(mockGenerateContent).toHaveBeenCalledWith('test prompt');
    expect(response).toBe('test response');
  });

  it('should allow setting API key after construction', async () => {
    const adapter = new GeminiAdapter();
    adapter.setApiKey('new-api-key');
    
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'test response',
      },
    });

    const response = await adapter.generateContent('test prompt');
    expect(response).toBe('test response');
  });
});
