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
} from '@google/genai';
import { ContentGenerator } from './contentGenerator.js';
import { providerRouter } from './simpleProviderRouter.js';

/**
 * Provider-aware content generator that routes requests to appropriate providers
 */
export class ProviderAwareContentGenerator implements ContentGenerator {
  private geminiGenerator: ContentGenerator;
  private currentModel: string;

  constructor(geminiGenerator: ContentGenerator, model: string) {
    this.geminiGenerator = geminiGenerator;
    this.currentModel = model;
  }

  async generateContent(
    request: GenerateContentParameters
  ): Promise<GenerateContentResponse> {
    // Check if we should use OpenRouter for this model
    if (providerRouter.shouldUseOpenRouter(this.currentModel)) {
      return this.generateContentViaOpenRouter(request);
    }

    // Use original Gemini generator
    return this.geminiGenerator.generateContent(request);
  }

  async generateContentStream(
    request: GenerateContentParameters
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    // For now, streaming is only supported through Gemini
    // OpenRouter streaming can be added later
    if (providerRouter.shouldUseOpenRouter(this.currentModel)) {
      // Convert single response to async generator
      const response = await this.generateContentViaOpenRouter(request);
      return (async function* () {
        yield response;
      })();
    }

    return this.geminiGenerator.generateContentStream(request);
  }

  private async generateContentViaOpenRouter(
    request: GenerateContentParameters
  ): Promise<GenerateContentResponse> {
    try {
      // Convert Gemini format to OpenRouter format
      const messages = this.convertGeminiToOpenRouterFormat(request);
      
      // Make OpenRouter API call
      const response = await providerRouter.makeOpenRouterRequest(
        this.currentModel,
        messages
      );

      // Convert back to Gemini format
      return this.convertOpenRouterToGeminiFormat(response);
    } catch (error) {
      console.error('OpenRouter request failed:', error);
      throw error;
    }
  }

  private convertGeminiToOpenRouterFormat(request: GenerateContentParameters): any[] {
    const messages: any[] = [];

    // Simple conversion - extract text content and create user message
    try {
      // Handle contents if present
      if (request.contents) {
        const contentsArray = Array.isArray(request.contents) ? request.contents : [request.contents];
        
        for (const content of contentsArray) {
          const contentAny = content as any;
          const role = contentAny.role === 'user' ? 'user' : 'assistant';
          let text = '';
          
          // Extract text from parts
          if (contentAny.parts && Array.isArray(contentAny.parts)) {
            text = contentAny.parts
              .map((part: any) => part.text || '')
              .join(' ');
          } else if (typeof content === 'string') {
            text = content;
          }
          
          if (text.trim()) {
            messages.push({
              role,
              content: text.trim()
            });
          }
        }
      }
    } catch (error) {
      // Fallback: create a simple user message
      messages.push({
        role: 'user',
        content: 'Hello'
      });
    }

    // If no messages were created, create a default user message
    if (messages.length === 0) {
      messages.push({
        role: 'user',
        content: 'Hello'
      });
    }

    return messages;
  }

  private convertOpenRouterToGeminiFormat(response: any): GenerateContentResponse {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error('Invalid OpenRouter response format');
    }

    // Create a response that matches the expected structure
    const result: any = {
      candidates: [
        {
          content: {
            parts: [{ text: choice.message.content }],
            role: 'model'
          },
          finishReason: 'STOP',
          index: 0,
          safetyRatings: []
        }
      ],
      promptFeedback: {
        safetyRatings: []
      },
      usageMetadata: response.usage ? {
        promptTokenCount: response.usage.prompt_tokens || 0,
        candidatesTokenCount: response.usage.completion_tokens || 0,
        totalTokenCount: response.usage.total_tokens || 0
      } : undefined
    };

    // Add missing properties as getters to match GenerateContentResponse interface
    Object.defineProperty(result, 'text', {
      get: () => choice.message.content
    });
    
    Object.defineProperty(result, 'data', {
      get: () => result
    });

    return result as GenerateContentResponse;
  }

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // For non-Gemini models, provide estimate
    if (providerRouter.shouldUseOpenRouter(this.currentModel)) {
      // Simple token estimation
      let totalText = '';
      
      try {
        if (request.contents) {
          const contentsArray = Array.isArray(request.contents) ? request.contents : [request.contents];
          totalText = contentsArray
            .map((content: any) => {
              if (content.parts && Array.isArray(content.parts)) {
                return content.parts.map((part: any) => part.text || '').join(' ');
              }
              return typeof content === 'string' ? content : '';
            })
            .join(' ');
        }
      } catch (error) {
        totalText = 'estimated content';
      }
      
      const estimatedTokens = Math.ceil(totalText.length / 4); // Rough estimate
      
      return {
        totalTokens: estimatedTokens
      };
    }

    return this.geminiGenerator.countTokens(request);
  }

  async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    // Embeddings only supported through Gemini for now
    return this.geminiGenerator.embedContent(request);
  }
}
