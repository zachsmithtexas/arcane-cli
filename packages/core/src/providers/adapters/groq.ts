/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GroqMessage {
  role: string;
  content: string;
}

export interface GroqResponse {
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

export class GroqAdapter {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.groq.com/openai/v1/chat/completions') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async makeRequest(model: string, messages: GroqMessage[]): Promise<GroqResponse> {
    const body = {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 4000,
      stream: false,
    };

    console.log(`🔀 Routing ${model} to Groq...`);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', errorText);
      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  static isGroqModel(model: string): boolean {
    const groqModels = [
      // Preview models
      'deepseek-r1-distill-llama-70b',
      'meta-llama/llama-4-maverick-17b-128e-instruct',
      'meta-llama/llama-4-scout-17b-16e-instruct', 
      'meta-llama/llama-prompt-guard-2-22m',
      'meta-llama/llama-prompt-guard-2-86m',
      'moonshotai/kimi-k2-instruct',
      'qwen/qwen3-32b',
      // Production models
      'gemma2-9b-it',
      'llama-3.1-8b-instant',
      'llama-3.3-70b-versatile',
      'meta-llama/llama-guard-4-12b',
      'whisper-large-v3',
      'whisper-large-v3-turbo'
    ];
    
    return groqModels.includes(model);
  }
}
