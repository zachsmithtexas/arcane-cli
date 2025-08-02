/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

export interface ProviderConfig {
  id: string;
  enabled: boolean;
  apiKeys: string[];
}

export interface ProvidersConfig {
  providers: ProviderConfig[];
  fallbackOrder: string[];
}

/**
 * Quick provider integration for OpenRouter models
 */
export class SimpleProviderRouter {
  private config: ProvidersConfig | null = null;

  async loadConfig(): Promise<void> {
    try {
      const configPath = resolve(process.cwd(), 'providers.json');
      const configFile = await readFile(configPath, 'utf-8');
      this.config = JSON.parse(configFile);
    } catch (error) {
      this.config = { providers: [], fallbackOrder: [] };
    }
  }

  shouldUseOpenRouter(model: string): boolean {
    // Check if model name suggests OpenRouter
    const openRouterPrefixes = [
      'deepseek/',
      'openai/',
      'anthropic/',
      'meta-llama/',
      'qwen/',
      'mistralai/',
    ];
    
    return openRouterPrefixes.some(prefix => model.startsWith(prefix));
  }

  async getOpenRouterApiKey(): Promise<string | null> {
    await this.loadConfig();
    
    if (!this.config) return null;
    
    const openRouterProvider = this.config.providers.find(p => p.id === 'openrouter');
    if (!openRouterProvider || !openRouterProvider.enabled || !openRouterProvider.apiKeys.length) {
      return null;
    }
    
    return openRouterProvider.apiKeys[0];
  }

  async makeOpenRouterRequest(model: string, messages: any[]): Promise<any> {
    const apiKey = await this.getOpenRouterApiKey();
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured. Run: ./arcane provider add openrouter --api-key YOUR_KEY');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/zachsmithtexas/arcane-cli',
        'X-Title': 'Arcane CLI'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4000,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }
}

export const providerRouter = new SimpleProviderRouter();
