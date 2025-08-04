/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProviderAdapter } from '../loader.js';

export interface OpenRouterMessage {
  role: string;
  content: string;
}

export interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterAdapter implements ProviderAdapter {
  readonly id = 'openrouter';
  private apiKey: string = '';
  private model: string = 'openai/gpt-3.5-turbo';
  private baseUrl: string;

  constructor(baseUrl = 'https://openrouter.ai/api/v1/chat/completions') {
    this.baseUrl = baseUrl;
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setModel(model: string): void {
    this.model = model;
  }

  async generateContent(prompt: string): Promise<string> {
    const messages: OpenRouterMessage[] = [{ role: 'user', content: prompt }];
    const response = await this.makeRequest(this.model, messages);
    return response.choices[0]?.message?.content || '';
  }

  async makeRequest(model: string, messages: OpenRouterMessage[]): Promise<OpenRouterResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not set');
    }

    const body = {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 4000,
      stream: false,
    };

    console.log(`🔀 Routing ${model} to OpenRouter...`);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/zachsmithtexas/arcane-cli',
        'X-Title': 'Arcane CLI',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  static isOpenRouterModel(model: string): boolean {
    const openRouterPrefixes = [
      'deepseek/', 'qwen/', 'mistralai/', 'meta-llama/', 'google/', 'moonshotai/',
      'nvidia/', 'nousresearch/', 'agentica-org/', 'cognitivecomputations/',
      'tencent/', 'sarvamai/', 'thudm/', 'shisa-ai/', 'arliai/', 'featherless/',
      'rekaai/', 'tngtech/', 'microsoft/', 'z-ai/'
    ];
    
    return openRouterPrefixes.some(prefix => model.startsWith(prefix)) || 
           model.includes(':free');
  }
}

// Export as default for the loader
export default OpenRouterAdapter;
