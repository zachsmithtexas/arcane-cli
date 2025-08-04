/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TogetherMessage {
  role: string;
  content: string;
}

export interface TogetherResponse {
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

export class TogetherAdapter {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.together.xyz/v1/chat/completions') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async makeRequest(model: string, messages: TogetherMessage[]): Promise<TogetherResponse> {
    const body = {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 4000,
      stream: false,
    };

    console.log(`🔀 Routing ${model} to Together.ai...`);

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
      console.error('Together.ai API error:', errorText);
      throw new Error(`Together.ai API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  static isTogetherModel(model: string): boolean {
    const togetherModels = [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
      'lgai/exaone-3-5-32b-instruct',
      'lgai/exaone-deep-32b',
      'deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free',
      'meta-llama/Llama-Vision-Free',
      'arcee-ai/AFM-4.5B'
    ];
    
    return togetherModels.includes(model) || 
           model.startsWith('lgai/') || 
           model.startsWith('deepseek-ai/');
  }
}
