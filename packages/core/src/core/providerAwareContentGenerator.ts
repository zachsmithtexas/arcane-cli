/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensResponse,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  Content,
  Part,
} from '@google/genai';
import { ContentGenerator } from './contentGenerator.js';
import { enhancedProviderRouter } from './enhancedProviderRouter.js';

interface StandardMessage {
  role: string;
  content: string;
}

interface StandardChoice {
  message: {
    content: string;
  };
}

interface StandardResponse {
  choices: StandardChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Legacy interfaces for compatibility
interface OpenRouterMessage {
  role: string;
  content: string;
}

interface OpenRouterChoice {
  message: {
    content: string;
  };
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Provider-aware content generator that routes requests to appropriate providers
 */
export class ProviderAwareContentGenerator implements ContentGenerator {
  private geminiGenerator: ContentGenerator | null;
  private currentModel: string;

  constructor(geminiGenerator: ContentGenerator | null, model: string) {
    this.geminiGenerator = geminiGenerator;
    this.currentModel = model;
  }

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    // Check if we should use non-Gemini provider for this model
    if (enhancedProviderRouter.shouldUseNonGeminiProvider(this.currentModel)) {
      return this.generateContentViaNonGeminiProvider(request);
    }

    // Use original Gemini generator
    if (!this.geminiGenerator) {
      throw new Error('Gemini generator not available for this model');
    }
    return this.geminiGenerator.generateContent(request);
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    // For now, streaming is only supported through Gemini
    // Other provider streaming can be added later
    if (enhancedProviderRouter.shouldUseNonGeminiProvider(this.currentModel)) {
      // Convert single response to async generator
      const response = await this.generateContentViaNonGeminiProvider(request);
      return (async function* () {
        yield response;
      })();
    }

    if (!this.geminiGenerator) {
      throw new Error('Gemini generator not available for streaming');
    }
    return this.geminiGenerator.generateContentStream(request);
  }

  private async generateContentViaNonGeminiProvider(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    try {
      // Convert Gemini format to standard format
      const messages = this.convertGeminiToStandardFormat(request);

      // Make request through enhanced router
      const response = await enhancedProviderRouter.makeRequest(
        this.currentModel,
        messages,
      );

      // Convert back to Gemini format
      return this.convertStandardToGeminiFormat(response);
    } catch (error) {
      console.error('Multi-provider request failed:', error);
      throw error;
    }
  }

  private convertGeminiToStandardFormat(
    request: GenerateContentParameters,
  ): StandardMessage[] {
    const messages: StandardMessage[] = [];

    // Simple conversion - extract text content and create user message
    try {
      // Handle contents if present
      if (request.contents) {
        const contentsArray = Array.isArray(request.contents)
          ? request.contents
          : [request.contents];

        for (const content of contentsArray) {
          const contentAny = content as Content;
          const role = contentAny.role === 'user' ? 'user' : 'assistant';
          let text = '';

          // Extract text from parts
          if (contentAny.parts && Array.isArray(contentAny.parts)) {
            text = contentAny.parts
              .map((part: Part) => ('text' in part ? part.text : ''))
              .join(' ');
          }

          if (text.trim()) {
            messages.push({
              role,
              content: text.trim(),
            });
          }
        }
      }
    } catch (_error) {
      // Fallback: create a simple user message
      messages.push({
        role: 'user',
        content: 'Hello',
      });
    }

    // If no messages were created, create a default user message
    if (messages.length === 0) {
      messages.push({
        role: 'user',
        content: 'Hello',
      });
    }

    return messages;
  }

  private convertStandardToGeminiFormat(
    response: StandardResponse,
  ): GenerateContentResponse {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error('Invalid provider response format');
    }

    // Create a response that matches the expected structure
    const result = {
      candidates: [
        {
          content: {
            parts: [{ text: choice.message.content }],
            role: 'model',
          },
          finishReason: 'STOP',
          index: 0,
          safetyRatings: [],
        },
      ],
      promptFeedback: {
        safetyRatings: [],
      },
      usageMetadata: response.usage
        ? {
            promptTokenCount: response.usage.prompt_tokens || 0,
            candidatesTokenCount: response.usage.completion_tokens || 0,
            totalTokenCount: response.usage.total_tokens || 0,
          }
        : undefined,
    };

    return {
      ...result,
      text: () => choice.message.content,
    } as unknown as GenerateContentResponse;
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // For non-Gemini models, provide estimate
    if (enhancedProviderRouter.shouldUseNonGeminiProvider(this.currentModel)) {
      // Simple token estimation
      let totalText = '';

      try {
        if (request.contents) {
          const contentsArray = Array.isArray(request.contents)
            ? request.contents
            : [request.contents];
          totalText = contentsArray
            .map((content) => {
              const contentAny = content as Content;
              if (contentAny.parts && Array.isArray(contentAny.parts)) {
                return contentAny.parts
                  .map((part) => ('text' in part ? part.text : ''))
                  .join(' ');
              }
              return '';
            })
            .join(' ');
        }
      } catch (_error) {
        totalText = 'estimated content';
      }

      const estimatedTokens = Math.ceil(totalText.length / 4); // Rough estimate

      return {
        totalTokens: estimatedTokens,
      };
    }

    if (!this.geminiGenerator) {
      throw new Error('Gemini generator not available for token counting');
    }
    return this.geminiGenerator.countTokens(request);
  }

  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Embeddings only supported through Gemini for now
    if (!this.geminiGenerator) {
      throw new Error('Gemini generator not available for embeddings');
    }
    return this.geminiGenerator.embedContent(request);
  }
}
