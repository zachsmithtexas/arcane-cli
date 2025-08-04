/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { OpenRouterAdapter } from '../providers/adapters/openrouter.js';
import { GroqAdapter } from '../providers/adapters/groq.js';
import { TogetherAdapter } from '../providers/adapters/together.js';
import { OllamaAdapter } from '../providers/adapters/ollama.js';

export interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  apiKeys: string[];
  baseUrl?: string;
  maxRetries: number;
  rateLimitDelay: number;
  fallbackEnabled: boolean;
}

export interface ProvidersConfig {
  providers: ProviderConfig[];
  fallbackOrder: string[];
  globalSettings: {
    maxTotalRetries: number;
    enableAutoRotation: boolean;
    rateLimitThreshold: number;
    defaultProvider: string;
    healthCheckInterval: number;
  };
  models: Record<string, any>;
}

interface ProviderMessage {
  role: string;
  content: string;
}

interface ProviderResponse {
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

interface ProviderStats {
  requests: number;
  successes: number;
  failures: number;
  rateLimits: number;
  lastUsed: number;
  avgResponseTime: number;
}

/**
 * Enhanced provider router with fallback, rotation, and statistics
 */
export class EnhancedProviderRouter {
  private config: ProvidersConfig | null = null;
  private stats: Map<string, Map<string, ProviderStats>> = new Map();
  private currentKeyIndex: Map<string, number> = new Map();

  async loadConfig(): Promise<void> {
    try {
      const configPath = resolve(process.cwd(), 'providers.json');
      console.log('Loading provider config from:', configPath);
      const configFile = await readFile(configPath, 'utf-8');
      this.config = JSON.parse(configFile);
      console.log('Provider config loaded');
      
      // Initialize stats for all providers and keys
      this.initializeStats();
    } catch (error) {
      console.error('Error loading provider config:', error);
      this.config = { 
        providers: [], 
        fallbackOrder: [],
        globalSettings: {
          maxTotalRetries: 10,
          enableAutoRotation: true,
          rateLimitThreshold: 60000,
          defaultProvider: 'openrouter',
          healthCheckInterval: 300000
        },
        models: {}
      };
    }
  }

  private initializeStats(): void {
    if (!this.config) return;

    for (const provider of this.config.providers) {
      const providerStats = new Map<string, ProviderStats>();
      
      for (const apiKey of provider.apiKeys) {
        providerStats.set(apiKey, {
          requests: 0,
          successes: 0,
          failures: 0,
          rateLimits: 0,
          lastUsed: 0,
          avgResponseTime: 0
        });
      }
      
      this.stats.set(provider.id, providerStats);
      this.currentKeyIndex.set(provider.id, 0);
    }
  }

  private getProviderForModel(model: string): string {
    // OpenRouter models (check first for :free models)
    if (OpenRouterAdapter.isOpenRouterModel(model)) {
      return 'openrouter';
    }
    
    // Groq models
    if (GroqAdapter.isGroqModel(model)) {
      return 'groq';
    }
    
    // Together.ai models  
    if (TogetherAdapter.isTogetherModel(model)) {
      return 'together';
    }
    
    // Ollama models (check last since it has generic patterns)
    if (OllamaAdapter.isOllamaModel(model)) {
      return 'ollama';
    }
    
    // Default to Gemini for everything else
    return 'gemini';
  }

  private getApiKey(providerId: string): string | null {
    // First check environment variables
    const envKey = this.getEnvironmentApiKey(providerId);
    if (envKey) {
      return envKey;
    }

    // Then check config file with rotation
    if (!this.config) return null;

    const provider = this.config.providers.find(p => p.id === providerId);
    if (!provider || !provider.enabled || !provider.apiKeys.length) {
      return null;
    }

    const currentIndex = this.currentKeyIndex.get(providerId) || 0;
    const apiKey = provider.apiKeys[currentIndex];
    
    // Rotate to next key for next request
    if (this.config.globalSettings.enableAutoRotation) {
      const nextIndex = (currentIndex + 1) % provider.apiKeys.length;
      this.currentKeyIndex.set(providerId, nextIndex);
    }

    return apiKey;
  }

  private getEnvironmentApiKey(providerId: string): string | null {
    const envVarMap: Record<string, string> = {
      'openrouter': 'OPENROUTER_API_KEY',
      'groq': 'GROQ_API_KEY', 
      'together': 'TOGETHER_API_KEY',
      'gemini': 'GEMINI_API_KEY'
    };

    const envVar = envVarMap[providerId];
    if (!envVar) return null;
    
    const envValue = process.env[envVar];
    if (!envValue) return null;
    
    // Support multiple API keys separated by commas
    const keys = envValue.split(',').map(key => key.trim()).filter(key => key.length > 0);
    if (keys.length === 0) return null;
    
    // If multiple keys, rotate through them
    if (keys.length > 1) {
      const currentIndex = this.currentKeyIndex.get(`env_${providerId}`) || 0;
      const selectedKey = keys[currentIndex];
      
      // Rotate for next time
      if (this.config?.globalSettings.enableAutoRotation) {
        const nextIndex = (currentIndex + 1) % keys.length;
        this.currentKeyIndex.set(`env_${providerId}`, nextIndex);
      }
      
      return selectedKey;
    }
    
    return keys[0];
  }

  private updateStats(providerId: string, apiKey: string, success: boolean, isRateLimit: boolean, responseTime: number): void {
    const providerStats = this.stats.get(providerId);
    if (!providerStats) return;

    const keyStats = providerStats.get(apiKey);
    if (!keyStats) return;

    keyStats.requests++;
    keyStats.lastUsed = Date.now();
    
    if (success) {
      keyStats.successes++;
    } else {
      keyStats.failures++;
    }
    
    if (isRateLimit) {
      keyStats.rateLimits++;
    }

    // Update average response time
    keyStats.avgResponseTime = (keyStats.avgResponseTime * (keyStats.requests - 1) + responseTime) / keyStats.requests;
  }

  async makeRequest(model: string, messages: ProviderMessage[]): Promise<ProviderResponse> {
    await this.loadConfig();
    
    const primaryProvider = this.getProviderForModel(model);
    const fallbackProviders = this.config?.fallbackOrder || [primaryProvider];
    
    let lastError: Error | null = null;
    let totalRetries = 0;
    const maxTotalRetries = this.config?.globalSettings.maxTotalRetries || 10;

    // Try primary provider first, then fallbacks
    for (const providerId of [primaryProvider, ...fallbackProviders.filter(p => p !== primaryProvider)]) {
      if (totalRetries >= maxTotalRetries) break;

      const provider = this.config?.providers.find(p => p.id === providerId);
      if (!provider || !provider.enabled) continue;

      // Try all keys for this provider
      const maxProviderRetries = provider.maxRetries || 3;
      for (let attempt = 0; attempt < maxProviderRetries && totalRetries < maxTotalRetries; attempt++) {
        const apiKey = this.getApiKey(providerId);
        if (!apiKey && providerId !== 'ollama') {
          console.log(`No API key available for ${providerId}, skipping...`);
          break;
        }

        const startTime = Date.now();
        
        try {
          const response = await this.makeProviderRequest(providerId, model, messages, apiKey);
          const responseTime = Date.now() - startTime;
          
          if (apiKey) {
            this.updateStats(providerId, apiKey, true, false, responseTime);
          }
          
          console.log(`✅ Request successful via ${providerId}`);
          return response;
          
        } catch (error) {
          const responseTime = Date.now() - startTime;
          const isRateLimit = this.isRateLimitError(error);
          
          if (apiKey) {
            this.updateStats(providerId, apiKey, false, isRateLimit, responseTime);
          }
          
          lastError = error as Error;
          totalRetries++;
          
          console.log(`❌ Request failed via ${providerId} (attempt ${attempt + 1}): ${lastError.message}`);
          
          if (isRateLimit && provider.rateLimitDelay) {
            console.log(`⏳ Rate limited, waiting ${provider.rateLimitDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, provider.rateLimitDelay));
          }
        }
      }
    }

    throw new Error(`All providers failed after ${totalRetries} attempts. Last error: ${lastError?.message}`);
  }

  private async makeProviderRequest(
    providerId: string, 
    model: string, 
    messages: ProviderMessage[], 
    apiKey: string | null
  ): Promise<ProviderResponse> {
    switch (providerId) {
      case 'openrouter': {
        if (!apiKey) throw new Error('OpenRouter API key required');
        const adapter = new OpenRouterAdapter();
        adapter.setApiKey(apiKey);
        return adapter.makeRequest(model, messages);
      }
      
      case 'groq': {
        if (!apiKey) throw new Error('Groq API key required');
        const adapter = new GroqAdapter(apiKey);
        return adapter.makeRequest(model, messages);
      }
      
      case 'together': {
        if (!apiKey) throw new Error('Together.ai API key required');
        const adapter = new TogetherAdapter(apiKey);
        return adapter.makeRequest(model, messages);
      }
      
      case 'ollama': {
        const adapter = new OllamaAdapter();
        return adapter.makeRequest(model, messages);
      }
      
      default:
        throw new Error(`Unsupported provider: ${providerId}`);
    }
  }

  private isRateLimitError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    return errorMessage.includes('rate limit') || 
           errorMessage.includes('429') ||
           errorMessage.includes('quota');
  }

  shouldUseNonGeminiProvider(model: string): boolean {
    const provider = this.getProviderForModel(model);
    return provider !== 'gemini';
  }

  // Legacy method for compatibility
  shouldUseOpenRouter(model: string): boolean {
    return this.getProviderForModel(model) === 'openrouter';
  }

  async getOpenRouterApiKey(): Promise<string | null> {
    return this.getApiKey('openrouter');
  }

  getProviderStats(): Record<string, Record<string, ProviderStats>> {
    const result: Record<string, Record<string, ProviderStats>> = {};
    
    for (const [providerId, providerStats] of this.stats) {
      result[providerId] = {};
      for (const [apiKey, stats] of providerStats) {
        // Mask API key for security
        const maskedKey = apiKey.slice(0, 8) + '...' + apiKey.slice(-4);
        result[providerId][maskedKey] = { ...stats };
      }
    }
    
    return result;
  }

  getAllModels(): Record<string, string[]> {
    if (!this.config) return {};
    
    const result: Record<string, string[]> = {};
    
    for (const [providerId, models] of Object.entries(this.config.models)) {
      if (providerId === 'groq' && typeof models === 'object') {
        // Handle Groq's nested structure
        result[providerId] = [
          ...(models.preview || []),
          ...(models.production || [])
        ];
      } else if (Array.isArray(models)) {
        result[providerId] = models;
      }
    }
    
    return result;
  }

  getCurrentModel(): string {
    // This should be set by the model management system
    return process.env.CURRENT_MODEL || 'gemini-1.5-flash-latest';
  }

  setCurrentModel(model: string): void {
    process.env.CURRENT_MODEL = model;
  }
  
  // Usage tracking methods
  getUsageStats(): {
    totalRequests: number;
    totalSuccesses: number;
    totalFailures: number;
    totalRateLimits: number;
    providerBreakdown: Record<string, {
      requests: number;
      successes: number;
      failures: number;
      rateLimits: number;
      successRate: number;
      avgResponseTime: number;
    }>;
  } {
    let totalRequests = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;
    let totalRateLimits = 0;
    
    const providerBreakdown: Record<string, any> = {};
    
    for (const [providerId, providerStats] of this.stats) {
      let providerRequests = 0;
      let providerSuccesses = 0;
      let providerFailures = 0;
      let providerRateLimits = 0;
      let totalResponseTime = 0;
      
      for (const [_, keyStats] of providerStats) {
        providerRequests += keyStats.requests;
        providerSuccesses += keyStats.successes;
        providerFailures += keyStats.failures;
        providerRateLimits += keyStats.rateLimits;
        totalResponseTime += keyStats.avgResponseTime * keyStats.requests;
      }
      
      totalRequests += providerRequests;
      totalSuccesses += providerSuccesses;
      totalFailures += providerFailures;
      totalRateLimits += providerRateLimits;
      
      providerBreakdown[providerId] = {
        requests: providerRequests,
        successes: providerSuccesses,
        failures: providerFailures,
        rateLimits: providerRateLimits,
        successRate: providerRequests > 0 ? (providerSuccesses / providerRequests) * 100 : 0,
        avgResponseTime: providerRequests > 0 ? totalResponseTime / providerRequests : 0
      };
    }
    
    return {
      totalRequests,
      totalSuccesses,
      totalFailures,
      totalRateLimits,
      providerBreakdown
    };
  }
  
  // Reset usage statistics
  resetStats(): void {
    for (const [providerId, providerStats] of this.stats) {
      for (const [apiKey, _] of providerStats) {
        providerStats.set(apiKey, {
          requests: 0,
          successes: 0,
          failures: 0,
          rateLimits: 0,
          lastUsed: 0,
          avgResponseTime: 0
        });
      }
    }
  }
  
  // Get current API key being used for a provider (for debugging)
  getCurrentApiKeyIndex(providerId: string): number {
    return this.currentKeyIndex.get(providerId) || 0;
  }
  
  // Manually rotate to next API key for a provider
  rotateApiKey(providerId: string): boolean {
    if (!this.config) return false;
    
    const provider = this.config.providers.find(p => p.id === providerId);
    if (!provider || provider.apiKeys.length <= 1) return false;
    
    const currentIndex = this.currentKeyIndex.get(providerId) || 0;
    const nextIndex = (currentIndex + 1) % provider.apiKeys.length;
    this.currentKeyIndex.set(providerId, nextIndex);
    
    console.log(`🔄 Manually rotated ${providerId} API key to index ${nextIndex}`);
    return true;
  }
}

export const enhancedProviderRouter = new EnhancedProviderRouter();
