/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OllamaMessage {
  role: string;
  content: string;
}

export interface OllamaResponse {
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

export class OllamaAdapter {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:11434/v1/chat/completions') {
    this.baseUrl = baseUrl;
  }

  async makeRequest(model: string, messages: OllamaMessage[]): Promise<OllamaResponse> {
    const body = {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 4000,
      stream: false,
    };

    console.log(`🔀 Routing ${model} to Ollama...`);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama API error:', errorText);
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  static isOllamaModel(model: string): boolean {
    const ollamaModels = [
      'deepseek-r1:8b'
    ];
    
    // Only match specific Ollama models or models with colon that aren't :free models
    return ollamaModels.includes(model) || (model.includes(':') && !model.includes(':free'));
  }

  async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl.replace('/v1/chat/completions', '/api/tags'), {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
